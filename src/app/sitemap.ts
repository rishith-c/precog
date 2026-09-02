import type { MetadataRoute } from "next";
const base = "https://precog-tau.vercel.app";
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${base}/`,        lastModified: now, changeFrequency: "weekly",  priority: 1 },
    { url: `${base}/method`,  lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/docs`,    lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/terms`,   lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
  ];
}
