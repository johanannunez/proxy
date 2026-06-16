"use client";

import { PlateElement } from "platejs/react";
import type { ComponentProps } from "react";

type ElProps = ComponentProps<typeof PlateElement>;

export const H1El = (p: ElProps) => <PlateElement as="h1" {...p} />;
export const H2El = (p: ElProps) => <PlateElement as="h2" {...p} />;
export const H3El = (p: ElProps) => <PlateElement as="h3" {...p} />;
export const H4El = (p: ElProps) => <PlateElement as="h4" {...p} />;
export const H5El = (p: ElProps) => <PlateElement as="h5" {...p} />;
export const H6El = (p: ElProps) => <PlateElement as="h6" {...p} />;
export const PEl = (p: ElProps) => <PlateElement as="p" {...p} />;
export const BlockquoteEl = (p: ElProps) => (
  <PlateElement as="blockquote" {...p} />
);
export const HrEl = (p: ElProps) => <PlateElement as="hr" {...p} />;
export const UlEl = (p: ElProps) => <PlateElement as="ul" {...p} />;
export const OlEl = (p: ElProps) => <PlateElement as="ol" {...p} />;
export const LiEl = (p: ElProps) => <PlateElement as="li" {...p} />;
export const LicEl = (p: ElProps) => <PlateElement as="div" {...p} />;
export const CodeBlockEl = (p: ElProps) => <PlateElement as="pre" {...p} />;
export const CodeLineEl = (p: ElProps) => <PlateElement as="div" {...p} />;
export const LinkEl = (p: ElProps) => <PlateElement as="a" {...p} />;

export function ImageEl(p: ElProps) {
  // Cast element to access the url property set by the image plugin
  const url = (p.element as { url?: string }).url;
  return (
    <PlateElement {...p}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        style={{ maxWidth: "100%" }}
        contentEditable={false}
      />
      {p.children}
    </PlateElement>
  );
}
