"use client";

import { useState, useEffect } from "react";

const REVIEWS = [
  {
    quote:
      "Proxy is the first tool that actually feels like it was built for landlords, not accountants. I open it every morning before anything else and I already know where everything stands.",
    name: "Maria T.",
    meta: "Kennewick, WA · 4 properties",
  },
  {
    quote:
      "I used to dread Mondays. Now I open Proxy first thing and everything is right there. It completely changed how I think about owning and managing properties.",
    name: "Derek W.",
    meta: "Spokane, WA · 6 units · Owner since 2023",
  },
  {
    quote:
      "The financial reports alone are worth every penny. My accountant loves me now. Everything is organized, categorized, and ready to go at the end of every single month.",
    name: "Sandra M.",
    meta: "Richland, WA · 3 properties",
  },
  {
    quote:
      "Switching to Proxy was the best decision I made for my rental business. I spend half the time I used to on admin work and actually enjoy managing my units now.",
    name: "James R.",
    meta: "Portland, OR · 8 units",
  },
];

const PAUSE_MS = 4200;
const ANIM_MS = 440;

export function RotatingTestimonials() {
  const [state, setState] = useState({
    index: 0,
    phase: "idle" as "idle" | "exit" | "enter",
  });

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;

    const id = setInterval(() => {
      setState((s) => ({ ...s, phase: "exit" }));
      t1 = setTimeout(() => {
        setState((s) => ({
          index: (s.index + 1) % REVIEWS.length,
          phase: "enter",
        }));
        t2 = setTimeout(() => {
          setState((s) => ({ ...s, phase: "idle" }));
        }, ANIM_MS);
      }, ANIM_MS);
    }, PAUSE_MS + ANIM_MS);

    return () => {
      clearInterval(id);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const review = REVIEWS[state.index];

  const cardStyle: React.CSSProperties = {
    transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
    opacity: state.phase === "exit" ? 0 : 1,
    transform:
      state.phase === "exit"
        ? "scale(0.93) translateY(-12px)"
        : state.phase === "enter"
          ? "scale(0.96) translateY(14px)"
          : "scale(1) translateY(0px)",
  };

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          width: "200px",
          height: "110px",
          background:
            "linear-gradient(135deg, rgba(2,170,235,0.3) 0%, rgba(27,119,190,0.42) 100%)",
          borderRadius: "62% 38% 55% 45% / 48% 28% 72% 52%",
          bottom: "-10px",
          right: "-8px",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.85)",
          borderRadius: "14px",
          padding: "13px 18px 12px",
          boxShadow: "0 2px 12px rgba(27,119,190,0.08)",
          ...cardStyle,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-lora), Georgia, serif",
            fontSize: "38px",
            lineHeight: "0.55",
            color: "var(--color-brand)",
            display: "block",
            marginBottom: "8px",
            opacity: 0.8,
          }}
        >
          &ldquo;
        </span>

        <p
          style={{
            fontSize: "12px",
            color: "#4b5563",
            lineHeight: "1.55",
            marginBottom: "8px",
            fontWeight: 400,
          }}
        >
          {review.quote}
        </p>

        <div
          style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}
        >
          <span style={{ color: "#f59e0b", fontSize: "10px", letterSpacing: "1px" }}>
            ★★★★★
          </span>
          <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#1a1a1a" }}>
            {review.name}
          </span>
          <span style={{ fontSize: "11px", color: "#6b7280" }}>·</span>
          <span style={{ fontSize: "11px", color: "#6b7280" }}>{review.meta}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "4px",
          marginTop: "10px",
          paddingLeft: "2px",
        }}
      >
        {REVIEWS.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === state.index ? "16px" : "4px",
              height: "4px",
              borderRadius: "2px",
              background:
                i === state.index
                  ? "var(--color-brand)"
                  : "rgba(27,119,190,0.2)",
              transition: "width 0.35s ease, background 0.35s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
