"use client";

/**
 * FileCardTile — premium portrait file-card visual.
 *
 * Card anatomy:
 *   - Shell: white/dark-elevated surface, 1px ring (--border), rounded-md
 *   - Sheen: 1px inset highlight at top edge (--dash-shadow-inset)
 *   - Face gradient: lighter at top, slightly deeper at bottom
 *   - Motif lines: type-accented first line, neutral filler lines; per-type
 *     internal illustration (agreement / bank / card / grid / form / seal /
 *     shield / id)
 *   - Banner: bottom-right badge overhanging slightly, gradient type-color
 *     bg, white text, drop shadow
 *
 * scale prop (default 1):
 *   Multiplies all pixel dimensions uniformly. Canonical base = 56 x 72.
 *   < 0.7: simplified motif (shell + sheen + banner + ≤2 lines).
 *
 * Hover (when card is wrapped in a clickable row): translateY(-1px) + stronger
 *   shadow via parent's own CSS hover. The card itself only provides the shell;
 *   the animated lift lives on the parent row/card per its own module class.
 */

import { Bank, ShieldCheck, IdentificationCard } from "@phosphor-icons/react";
import type { DocIconConfig, DocMotif } from "./status-board-icons";
import styles from "./StatusBoard.module.css";

export interface FileCardTileProps {
  config: DocIconConfig;
  scale?: number;
}

/* ─── Utility ─── */

function px(n: number): number {
  return Math.round(n);
}

/* ─── Motif renderers ─── */

interface MotifProps {
  motif: DocMotif;
  tintFg: string;
  scale: number;
  simplified: boolean;
}

function DocMotifContent({ motif, tintFg, scale, simplified }: MotifProps) {
  const lineH = Math.max(1, Math.round(2 * scale));
  const gap = Math.max(2, Math.round(3 * scale));
  const lineStyle = {
    height: lineH,
    borderRadius: 999,
  };

  /* Neutral line color — adapts to dark/light via text-primary mix */
  const neutral = "color-mix(in srgb, var(--text-primary, #111827) 12%, transparent)";
  const neutralMid = "color-mix(in srgb, var(--text-primary, #111827) 8%, transparent)";

  /* Accent first-line color */
  const accentStrong = `color-mix(in srgb, ${tintFg} 40%, transparent)`;
  const accentMid = `color-mix(in srgb, ${tintFg} 22%, transparent)`;
  const accentSoft = `color-mix(in srgb, ${tintFg} 14%, transparent)`;

  const lineBlock = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      {/* Title line — accented */}
      <div style={{ ...lineStyle, background: accentStrong, width: "70%" }} />
      {/* Body lines */}
      {!simplified && (
        <>
          <div style={{ ...lineStyle, background: neutral, width: "90%" }} />
          <div style={{ ...lineStyle, background: neutralMid, width: "75%" }} />
          <div style={{ ...lineStyle, background: neutral, width: "82%" }} />
        </>
      )}
      {simplified && (
        <div style={{ ...lineStyle, background: neutral, width: "85%" }} />
      )}
    </div>
  );

  if (simplified) {
    return lineBlock;
  }

  if (motif === "agreement") {
    /* Text lines + a signature line near the bottom */
    const sigLineY = Math.round(4 * scale);
    return (
      <>
        {lineBlock}
        {/* Signature line: longer accent + a small underline flourish */}
        <div
          style={{
            marginTop: sigLineY,
            display: "flex",
            flexDirection: "column",
            gap: Math.max(1, Math.round(1.5 * scale)),
          }}
        >
          <div style={{ ...lineStyle, background: accentMid, width: "60%" }} />
          <div style={{
            height: Math.max(1, Math.round(1 * scale)),
            borderRadius: 999,
            background: accentSoft,
            width: "45%",
          }} />
        </div>
      </>
    );
  }

  if (motif === "bank") {
    /* Text lines + a masked account row */
    return (
      <>
        {lineBlock}
        <div
          style={{
            marginTop: Math.round(4 * scale),
            display: "flex",
            alignItems: "center",
            gap: Math.round(2 * scale),
          }}
        >
          {/* Dots suggesting masked account digits */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: Math.max(2, Math.round(2.5 * scale)),
                height: Math.max(2, Math.round(2.5 * scale)),
                borderRadius: "50%",
                background: i < 3 ? accentMid : accentStrong,
              }}
            />
          ))}
          <div style={{ ...lineStyle, background: accentMid, width: "35%", marginLeft: Math.round(2 * scale) }} />
        </div>
        {/* Bank icon hint */}
        <div style={{ marginTop: Math.round(3 * scale), opacity: 0.5 }}>
          <Bank size={Math.max(8, Math.round(9 * scale))} weight="duotone" color={tintFg} />
        </div>
      </>
    );
  }

  if (motif === "card") {
    /* A small payment-card rectangle with a chip stripe */
    const cardW = Math.round(34 * scale);
    const cardH = Math.round(20 * scale);
    const chipW = Math.round(8 * scale);
    const chipH = Math.round(6 * scale);
    return (
      <>
        <div
          style={{
            width: cardW,
            height: cardH,
            borderRadius: Math.max(2, Math.round(3 * scale)),
            background: `linear-gradient(135deg, ${accentMid}, ${accentSoft})`,
            border: `1px solid ${accentMid}`,
            position: "relative",
            flexShrink: 0,
          }}
        >
          {/* Chip */}
          <div
            style={{
              position: "absolute",
              top: Math.round(5 * scale),
              left: Math.round(4 * scale),
              width: chipW,
              height: chipH,
              borderRadius: Math.max(1, Math.round(2 * scale)),
              background: `color-mix(in srgb, ${tintFg} 55%, white)`,
            }}
          />
          {/* Stripe near bottom */}
          <div
            style={{
              position: "absolute",
              bottom: Math.round(4 * scale),
              left: Math.round(4 * scale),
              right: Math.round(4 * scale),
              height: Math.max(1, Math.round(1.5 * scale)),
              borderRadius: 999,
              background: `color-mix(in srgb, ${tintFg} 30%, transparent)`,
            }}
          />
        </div>
        <div style={{ marginTop: Math.round(4 * scale), ...lineStyle, background: neutral, width: "75%" }} />
      </>
    );
  }

  if (motif === "grid") {
    /* A mini form grid: 2 rows x 2 columns of small cells */
    const cellH = Math.max(3, Math.round(4 * scale));
    const cellGap = Math.max(1, Math.round(1.5 * scale));
    return (
      <>
        <div style={{ ...lineStyle, background: accentStrong, width: "70%", marginBottom: gap }} />
        {[0, 1].map((row) => (
          <div
            key={row}
            style={{
              display: "flex",
              gap: cellGap,
              marginBottom: cellGap,
            }}
          >
            {[0, 1].map((col) => (
              <div
                key={col}
                style={{
                  flex: col === 0 ? "0 0 40%" : "1",
                  height: cellH,
                  borderRadius: Math.max(1, Math.round(1.5 * scale)),
                  background: row === 0 && col === 0 ? accentMid : neutral,
                  border: `1px solid ${neutralMid}`,
                }}
              />
            ))}
          </div>
        ))}
        <div style={{ ...lineStyle, background: neutral, width: "55%", marginTop: cellGap }} />
      </>
    );
  }

  if (motif === "form") {
    /* Label + field-underline pairs */
    const labelH = Math.max(1, Math.round(1.5 * scale));
    const fieldH = Math.max(2, Math.round(2.5 * scale));
    const pairGap = Math.max(1, Math.round(1.5 * scale));
    const blockGap = Math.max(2, Math.round(3 * scale));
    return (
      <>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ marginBottom: i < 2 ? blockGap : 0 }}>
            {/* Label */}
            <div style={{
              height: labelH,
              borderRadius: 999,
              background: accentMid,
              width: `${38 + i * 8}%`,
              marginBottom: pairGap,
            }} />
            {/* Field underline */}
            <div style={{
              height: fieldH,
              borderRadius: 999,
              background: neutral,
              width: "92%",
            }} />
          </div>
        ))}
      </>
    );
  }

  if (motif === "seal") {
    /* A badge/seal circle + 2 lines */
    const circleSize = Math.max(10, Math.round(14 * scale));
    return (
      <>
        <div
          style={{
            width: circleSize,
            height: circleSize,
            borderRadius: "50%",
            border: `${Math.max(1, Math.round(1.5 * scale))}px solid ${accentStrong}`,
            background: accentSoft,
            marginBottom: gap,
            flexShrink: 0,
          }}
        />
        <div style={{ ...lineStyle, background: accentMid, width: "65%" }} />
        <div style={{ ...lineStyle, background: neutral, width: "80%", marginTop: gap }} />
        <div style={{ ...lineStyle, background: neutralMid, width: "55%", marginTop: gap }} />
      </>
    );
  }

  if (motif === "shield") {
    /* A small shield glyph + 2 lines */
    return (
      <>
        <div style={{ opacity: 0.7, marginBottom: gap }}>
          <ShieldCheck size={Math.max(10, Math.round(13 * scale))} weight="duotone" color={tintFg} />
        </div>
        <div style={{ ...lineStyle, background: accentMid, width: "65%" }} />
        <div style={{ ...lineStyle, background: neutral, width: "80%", marginTop: gap }} />
        <div style={{ ...lineStyle, background: neutralMid, width: "50%", marginTop: gap }} />
      </>
    );
  }

  if (motif === "id") {
    /* A photo-box square + 2-3 short lines beside it */
    const photoSize = Math.max(8, Math.round(14 * scale));
    return (
      <div style={{ display: "flex", gap: Math.max(2, Math.round(3 * scale)), alignItems: "flex-start" }}>
        {/* Photo box */}
        <div
          style={{
            width: photoSize,
            height: photoSize,
            borderRadius: Math.max(1, Math.round(2 * scale)),
            background: accentSoft,
            border: `1px solid ${accentMid}`,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IdentificationCard
            size={Math.max(6, Math.round(8 * scale))}
            weight="duotone"
            color={tintFg}
          />
        </div>
        {/* Lines beside */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap }}>
          <div style={{ ...lineStyle, background: accentStrong, width: "90%" }} />
          <div style={{ ...lineStyle, background: neutral, width: "75%" }} />
          <div style={{ ...lineStyle, background: neutralMid, width: "60%" }} />
        </div>
      </div>
    );
  }

  return lineBlock;
}

/* ─── Main tile ─── */

export function FileCardTile({ config, scale = 1 }: FileCardTileProps) {
  const { tintFg, banner, motif } = config;

  /* Canonical dimensions at scale 1: 56 x 72 */
  const w = px(56 * scale);
  const h = px(72 * scale);
  const radius = Math.max(4, px(8 * scale));
  const pad = Math.max(3, px(6 * scale));

  const simplified = scale < 0.7;

  /* Banner dimensions */
  const bannerFontSize = Math.max(6, px(7.5 * scale));
  const bannerPadV = Math.max(1, px(2.5 * scale));
  const bannerPadH = Math.max(2, px(4 * scale));
  const bannerRadius = Math.max(2, px(3.5 * scale));
  /* Banner overhangs the card by ~4px at scale 1; clamp small */
  const bannerOverhang = simplified ? 0 : Math.max(0, px(4 * scale));

  return (
    <div
      className={styles.fileCardShell}
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        flexShrink: 0,
        position: "relative",
      }}
      aria-hidden
    >
      {/* Motif content — padded inset */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: `${pad}px ${pad}px ${simplified ? pad : px(18 * scale)}px ${pad}px`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <DocMotifContent
          motif={motif}
          tintFg={tintFg}
          scale={scale}
          simplified={simplified}
        />
      </div>

      {/* Format banner — bottom-right, slightly overhanging */}
      <div
        className={styles.fileCardBanner}
        style={{
          position: "absolute",
          bottom: simplified ? px(4 * scale) : px(5 * scale),
          right: -bannerOverhang,
          fontSize: bannerFontSize,
          padding: `${bannerPadV}px ${bannerPadH}px`,
          borderRadius: bannerRadius,
          letterSpacing: "0.04em",
          /* Gradient uses tintFg so it's crisp on both dark and light */
          background: `linear-gradient(135deg, ${tintFg}, color-mix(in srgb, ${tintFg} 80%, #000))`,
        }}
      >
        {banner}
      </div>
    </div>
  );
}
