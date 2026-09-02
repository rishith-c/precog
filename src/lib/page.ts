import { PageFeatures } from "./types";

/* Server-side DOM feature extraction. Regex over fetched HTML rather than a
   headless browser: one network round trip, no cold start, runs anywhere. */

const VALUE = /\b(free|save|faster|instantly|automat\w+|reduce|cut|boost|increase|grow|unlock|no credit card|money.back|guarantee|roi|revenue|efficien\w+)\b/gi;
const PROOF = /\b(trusted by|customers|users|companies|teams|rated|reviews?|testimonial|case stud\w+|g2|capterra|backed by|yc |y combinator|fortune 500|\d[\d,.]*\+? (?:customers|users|teams|companies|developers))\b/gi;
const URGENCY = /\b(now|today|limited|ends|hurry|last chance|only \d+|deadline|expires|don't miss|act fast)\b/gi;
const FRICTION = /\b(contact sales|book a demo|request access|talk to (?:us|sales)|schedule a call|fill out|apply|waitlist|enterprise only|minimum|per seat|annual contract)\b/gi;
const JARGON = /\b(synerg\w+|leverag\w+|holistic|paradigm|end.to.end|best.in.class|seamless\w*|robust|scalab\w+|cutting.edge|next.generation|revolutionary|disrupt\w+|innovat\w+ solution|orchestrat\w+|framework|platform.agnostic)\b/gi;
const OFFER = /\b(buy|shop|order now|pre-?order|add to (?:cart|bag)|from \$\s?\d|starting at|starts at|\$\s?\d[\d,.]*(?:\/mo|\s?per month)?|free shipping|trade[- ]in|financing|new\b|now available|available now|in stock|get it|try it|start (?:free|now)|learn more)\b/gi;
const PRICING = /(\$\s?\d|\bpricing\b|\bper month\b|\/mo\b|\bfree tier\b|\bstarts at\b|\bplans?\b)/i;
const CTA_TEXT = /\b(get started|start (?:free|now|building)|try (?:it )?free|sign up|book a demo|request a demo|contact sales|join|download|buy|subscribe|create account|start trial|get access|learn more|see pricing)\b/i;

function strip(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
}

const count = (s: string, re: RegExp) => (s.match(re) || []).length;

export async function extractPage(rawUrl: string): Promise<PageFeatures> {
  const t0 = Date.now();
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "accept": "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`the page returned HTTP ${res.status}`);
  const html = await res.text();

  const clean = strip(html);
  const text = clean.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
  const wordList = text.split(/\s+/).filter((w) => /[a-z]/i.test(w) && w.length > 1);

  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim().slice(0, 200);
  const description = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "").trim().slice(0, 300);
  const h1 = (clean.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 200);

  // CTA candidates: buttons, and links whose text reads like an action
  const ctas: string[] = [];
  const anchorish = clean.match(/<(?:a|button)[^>]*>([\s\S]{0,90}?)<\/(?:a|button)>/gi) ?? [];
  for (const a of anchorish) {
    const label = a.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (label.length > 1 && label.length < 42 && CTA_TEXT.test(label) && !ctas.includes(label)) ctas.push(label);
  }

  const avgWordLen = wordList.length
    ? wordList.reduce((p, c) => p + c.replace(/[^a-z]/gi, "").length, 0) / wordList.length : 4.5;

  return {
    url, finalUrl: res.url || url, title, description, h1,
    words: wordList.length,
    headings: count(clean, /<h[1-3][\s>]/gi),
    ctas: ctas.slice(0, 12),
    ctaCount: ctas.length,
    links: count(clean, /<a[\s>]/gi),
    images: count(clean, /<img[\s>]/gi) + count(html, /<svg[\s>]/gi),
    formFields: count(clean, /<(?:input|select|textarea)[\s>]/gi),
    scripts: count(html, /<script[\s>]/gi),
    bytes: html.length,
    avgWordLen,
    valueWords: count(text, VALUE),
    socialProof: count(text, PROOF),
    urgencyWords: count(text, URGENCY),
    frictionWords: count(text, FRICTION),
    jargonWords: count(text, JARGON),
    hasPricing: PRICING.test(text),
    offerWords: count(text, OFFER),
    fetchMs: Date.now() - t0,
  };
}
