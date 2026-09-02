"use client";

import { Encoding, NETWORKS } from "@/lib/types";

/* Six networks, six charts.

   The previous version drew all six as coloured lines on one axis. That only
   worked because hue was carrying the distinction — remove the colour and the
   chart is unreadable, which means the colour was load-bearing, not decorative.
   Small multiples carry it with position and a label instead, and as a bonus
   each network gets its own baseline so a quiet one is still legible. */

export function Sparks({ enc }: { enc: Encoding }) {
  const W = 150, H = 42;
  const n = enc.frames.length;

  return (
    <div className="sparks">
      {NETWORKS.map((net) => {
        const vals = enc.frames.map((f) => f.values[net.id]);
        const x = (i: number) => (i / (n - 1)) * W;
        const y = (v: number) => H - (v / 100) * H;
        const line = vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
        const area = `${line}L${W},${H}L0,${H}Z`;

        return (
          <div className="spark" key={net.id}>
            <div className="sh">
              <span className="sn">{net.label}</span>
              <span className="sv">{enc.peak[net.id]}</span>
            </div>
            <span className="sr">{net.roi}</span>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
              aria-label={`${net.label} peaks at ${enc.peak[net.id]} of 100 over ${n} seconds`}>
              <line className="bl" x1="0" y1={H} x2={W} y2={H} />
              <path className="ar" d={area} />
              <path className="ln" d={line} vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
