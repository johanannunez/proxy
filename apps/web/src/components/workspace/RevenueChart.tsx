"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  type MonthlyRevenue,
  type ComparisonRevenue,
  computeYTicks,
  formatChartCurrency,
  YEAR_COLORS,
} from "@/lib/chart-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SingleProps = {
  mode: "single";
  data: MonthlyRevenue[];
  title: string;
};

type CompareProps = {
  mode: "compare";
  data: ComparisonRevenue;
  years: number[];
  title: string;
};

type Props = SingleProps | CompareProps;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const MARGIN = { top: 16, right: 12, bottom: 32, left: 52 };
const DESKTOP_HEIGHT = 280;
const MOBILE_HEIGHT = 200;
const BAR_RADIUS = 4;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RevenueChart(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 600;
      setWidth(w);
      setIsMobile(w < 500);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = isMobile ? MOBILE_HEIGHT : DESKTOP_HEIGHT;
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;

  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <header
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: "var(--color-warm-gray-100)" }}
      >
        <h2
          className="text-[15px] font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {props.title}
        </h2>
        {props.mode === "compare" && (
          <Legend years={props.years} />
        )}
      </header>

      <div ref={containerRef} className="px-4 py-4 sm:px-6">
        <svg
          width={width - 32}
          height={height}
          viewBox={`0 0 ${width - 32} ${height}`}
          role="img"
          aria-label="Revenue chart"
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {props.mode === "single" ? (
              <SingleBars
                data={props.data}
                plotW={plotW}
                plotH={plotH}
                isMobile={isMobile}
              />
            ) : (
              <GroupedBars
                data={props.data}
                years={props.years}
                plotW={plotW}
                plotH={plotH}
                isMobile={isMobile}
              />
            )}
          </g>
        </svg>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Single bar mode (monthly revenue for one period)
// ---------------------------------------------------------------------------

function SingleBars({
  data,
  plotW,
  plotH,
  isMobile,
}: {
  data: MonthlyRevenue[];
  plotW: number;
  plotH: number;
  isMobile: boolean;
}) {
  const maxVal = Math.max(...data.map((d) => d.revenue), 1);
  const ticks = computeYTicks(maxVal);
  const yMax = ticks[ticks.length - 1] ?? maxVal;
  const barCount = data.length;
  const gap = isMobile ? 4 : 8;
  const barW = Math.max(8, (plotW - gap * (barCount - 1)) / barCount);

  return (
    <>
      <YAxis ticks={ticks} plotH={plotH} plotW={plotW} yMax={yMax} />
      {data.map((d, i) => {
        const barH = yMax > 0 ? (d.revenue / yMax) * plotH : 0;
        const x = i * (barW + gap);
        const y = plotH - barH;
        return (
          <g key={d.month}>
            <motion.rect
              x={x}
              y={plotH}
              width={barW}
              height={0}
              rx={BAR_RADIUS}
              fill="var(--color-brand)"
              animate={{ y, height: Math.max(barH, 0) }}
              transition={{ duration: 0.5, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
            />
            <text
              x={x + barW / 2}
              y={plotH + 16}
              textAnchor="middle"
              fill="var(--color-text-tertiary)"
              fontSize={isMobile ? 9 : 11}
              fontWeight={500}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Grouped bar mode (comparison across years)
// ---------------------------------------------------------------------------

function GroupedBars({
  data,
  years,
  plotW,
  plotH,
  isMobile,
}: {
  data: ComparisonRevenue;
  years: number[];
  plotW: number;
  plotH: number;
  isMobile: boolean;
}) {
  // In comparison mode, we show all 12 months on the X axis,
  // but only the selected month has data. This provides context
  // for where in the year the comparison falls.
  const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  const maxVal = Math.max(...Object.values(data.byYear), 1);
  const ticks = computeYTicks(maxVal);
  const yMax = ticks[ticks.length - 1] ?? maxVal;

  const groupCount = allMonths.length;
  const groupGap = isMobile ? 6 : 12;
  const groupW = (plotW - groupGap * (groupCount - 1)) / groupCount;
  const barGap = 2;
  const barW = Math.max(4, (groupW - barGap * (years.length - 1)) / years.length);

  return (
    <>
      <YAxis ticks={ticks} plotH={plotH} plotW={plotW} yMax={yMax} />
      {allMonths.map((m, gi) => {
        const groupX = gi * (groupW + groupGap);
        const isActive = m === data.month;
        const labels = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];

        return (
          <g key={m}>
            {/* Background highlight for the active month */}
            {isActive && (
              <rect
                x={groupX - 4}
                y={-4}
                width={groupW + 8}
                height={plotH + 8}
                rx={6}
                fill="var(--color-warm-gray-50)"
              />
            )}

            {years.map((year, yi) => {
              const val = isActive ? (data.byYear[year] ?? 0) : 0;
              const barH = yMax > 0 ? (val / yMax) * plotH : 0;
              const x = groupX + yi * (barW + barGap);
              const y = plotH - barH;
              const colorIndex = Math.min(yi, YEAR_COLORS.length - 1);

              return (
                <motion.rect
                  key={year}
                  x={x}
                  y={plotH}
                  width={barW}
                  height={0}
                  rx={BAR_RADIUS}
                  fill={isActive ? YEAR_COLORS[colorIndex] : "var(--color-warm-gray-100)"}
                  opacity={isActive ? 1 : 0.3}
                  animate={{
                    y: isActive ? y : plotH,
                    height: isActive ? Math.max(barH, 0) : 0,
                  }}
                  transition={{ duration: 0.5, delay: yi * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              );
            })}

            <text
              x={groupX + groupW / 2}
              y={plotH + 16}
              textAnchor="middle"
              fill={isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)"}
              fontSize={isMobile ? 8 : 10}
              fontWeight={isActive ? 600 : 400}
            >
              {labels[m - 1]}
            </text>
          </g>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared Y-axis gridlines
// ---------------------------------------------------------------------------

function YAxis({
  ticks,
  plotH,
  plotW,
  yMax,
}: {
  ticks: number[];
  plotH: number;
  plotW: number;
  yMax: number;
}) {
  return (
    <>
      {ticks.map((t) => {
        const y = yMax > 0 ? plotH - (t / yMax) * plotH : plotH;
        return (
          <g key={t}>
            <line
              x1={0}
              y1={y}
              x2={plotW}
              y2={y}
              stroke="var(--color-warm-gray-100)"
              strokeDasharray={t === 0 ? undefined : "4 4"}
            />
            <text
              x={-8}
              y={y + 3}
              textAnchor="end"
              fill="var(--color-text-tertiary)"
              fontSize={10}
              fontWeight={500}
            >
              {formatChartCurrency(t)}
            </text>
          </g>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Legend for comparison mode
// ---------------------------------------------------------------------------

function Legend({ years }: { years: number[] }) {
  return (
    <div className="flex items-center gap-3">
      {years.map((year, i) => {
        const colorIndex = Math.min(i, YEAR_COLORS.length - 1);
        return (
          <span
            key={year}
            className="flex items-center gap-1.5 text-[11px] font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded"
              style={{ backgroundColor: YEAR_COLORS[colorIndex] }}
            />
            {year}
          </span>
        );
      })}
    </div>
  );
}
