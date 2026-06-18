type Props = { done: number; total: number; color: string; size?: number };

export function PhaseProgressRing({ done, total, color, size = 48 }: Props) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total === 0 ? 0 : done / total;
  const dashOffset = circumference * (1 - progress);

  return (
    <svg
      width={size}
      height={size}
      aria-label={`${done} of ${total} done`}
      style={{ transform: "rotate(-90deg)", flexShrink: 0 }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-warm-gray-200)"
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
    </svg>
  );
}
