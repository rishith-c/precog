/* Recent scores, oldest to newest. One line, no axes, no colour — it is
   there to show direction, and a number that needs an axis belongs in the
   list underneath it. */
export default function Trend({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 100, h = 40;
  const lo = Math.min(...points), hi = Math.max(...points);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - ((v - lo) / span) * (h - 6) - 3;
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join("");

  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <line className="bl" x1="0" y1={h - 0.5} x2={w} y2={h - 0.5} />
      <path className="ln" d={d} vectorEffect="non-scaling-stroke" />
      <circle className="dt" cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="1.6" />
    </svg>
  );
}
