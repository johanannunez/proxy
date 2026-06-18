"use client";

import { createPlatePlugin, PlateElement } from "platejs/react";
import type { ComponentProps } from "react";
import { createElement } from "react";

type ElProps = ComponentProps<typeof PlateElement>;

function PageBreakElement(props: ElProps) {
  return createElement(
    PlateElement,
    props,
    createElement(
      "div",
      {
        contentEditable: false,
        style: {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 0",
          userSelect: "none",
          cursor: "default",
        },
      },
      createElement("div", {
        style: { flex: 1, borderTop: "1px dashed #94a3b8" },
      }),
      createElement(
        "span",
        {
          style: {
            fontSize: "11px",
            color: "#94a3b8",
            fontFamily: "sans-serif",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
          },
        },
        "Page break"
      ),
      createElement("div", {
        style: { flex: 1, borderTop: "1px dashed #94a3b8" },
      })
    ),
    // Plate requires children rendered even for void nodes
    props.children
  );
}

export const PageBreakPlugin = createPlatePlugin({
  key: "page_break",
  node: { isElement: true, isVoid: true, type: "page_break" },
  parsers: {
    html: {
      deserializer: {
        rules: [{ validNodeName: "DIV", validClassName: "page-break" }],
      },
    },
  },
}).withComponent(PageBreakElement);
