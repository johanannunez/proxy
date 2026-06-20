/**
 * Minimal area sparkline (pure SVG, server-rendered). Honest about thin data:
 * a single point or a perfectly flat series renders a dashed baseline rather than
 * an invented slope.
 */
export function Sparkline({
  data,
  id,
  width = 320,
  height = 56,
  className,
}: {
  data: number[];
  id: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const pad = 4;
  const innerH = height - pad * 2;
  const flat = data.length < 2 || Math.max(...data) === Math.min(...data);

  if (flat) {
    const y = height / 2;
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        className={className}
        aria-hidden="true"
      >
        <line
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke="var(--pc-accent-line)"
          strokeWidth={1.5}
          strokeDasharray="4 5"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / range) * innerH;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const fillId = `pc-spark-${id}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(2,170,235,0.28)" />
          <stop offset="100%" stopColor="rgba(2,170,235,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fillId})`} />
      <path d={line} fill="none" stroke="var(--pc-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
