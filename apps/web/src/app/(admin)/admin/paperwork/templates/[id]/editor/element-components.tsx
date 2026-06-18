"use client";

import { PlateElement, useEditorRef } from "platejs/react";
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

/**
 * List item. Task-list items carry a boolean `checked` on the node; render a
 * real checkbox bound to it (the `data-task-checkbox` wrapper lets the editor
 * CSS swap the bullet for a flex checkbox row). Plain list items are unchanged.
 */
export function LiEl(p: ElProps) {
  const editor = useEditorRef();
  const el = p.element as { checked?: boolean; listStyleType?: string };
  // A task item either tracks a boolean `checked` or carries the `todo` list
  // style. Gate on both so a freshly-toggled item (whose `checked` may not be
  // initialized yet) still renders a checkbox. The gate is additive, so a plain
  // list item (neither marker) is unaffected.
  const isTask = el.listStyleType === "todo" || typeof el.checked === "boolean";
  if (!isTask) return <PlateElement as="li" {...p} />;
  return (
    <PlateElement as="li" {...p}>
      <span
        data-task-checkbox=""
        contentEditable={false}
        style={{ flexShrink: 0, marginTop: 3 }}
      >
        <input
          type="checkbox"
          checked={Boolean(el.checked)}
          onChange={(e) => {
            const path = editor.api.findPath(p.element);
            if (path) {
              editor.tf.setNodes({ checked: e.target.checked }, { at: path });
            }
          }}
        />
      </span>
      {p.children}
    </PlateElement>
  );
}
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
