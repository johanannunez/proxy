"use client";

import type { CSSProperties } from "react";

interface Props {
  size?: number;
  className?: string;
}

export function ColorOrb({ size = 32, className = "" }: Props) {
  return (
    <div
      className={`color-orb-proxy ${className}`}
      style={{ width: size, height: size, flexShrink: 0 } as CSSProperties}
      aria-hidden
    />
  );
}
