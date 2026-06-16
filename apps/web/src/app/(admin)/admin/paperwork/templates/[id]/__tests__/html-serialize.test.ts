// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { createSlateEditor } from "platejs";
import {
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
} from "@platejs/basic-nodes";
import {
  BaseListPlugin,
  BaseBulletedListPlugin,
  BaseNumberedListPlugin,
  BaseListItemPlugin,
  BaseListItemContentPlugin,
} from "@platejs/list-classic";
import {
  BaseTablePlugin,
  BaseTableRowPlugin,
  BaseTableCellPlugin,
  BaseTableCellHeaderPlugin,
} from "@platejs/table";
import { valueToHtml, type SerializableNode } from "../html-serialize";

const PLUGINS = [
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseListPlugin,
  BaseBulletedListPlugin,
  BaseNumberedListPlugin,
  BaseListItemPlugin,
  BaseListItemContentPlugin,
  BaseTablePlugin,
  BaseTableRowPlugin,
  BaseTableCellPlugin,
  BaseTableCellHeaderPlugin,
];

function deserialize(html: string): SerializableNode[] {
  const editor = createSlateEditor({ plugins: PLUGINS });
  return editor.api.html.deserialize({ element: html }) as SerializableNode[];
}

// A comprehensive Value in the editor-NORMALIZED shape: list items wrap text in
// `lic`, table cells wrap text in `p`. This is what the live editor produces.
const NORMALIZED_VALUE: SerializableNode[] = [
  { type: "h1", children: [{ text: "Agreement" }] },
  { type: "h2", children: [{ text: "Section" }] },
  { type: "h3", children: [{ text: "Clause" }] },
  {
    type: "p",
    children: [
      { text: "This is " },
      { text: "bold", bold: true },
      { text: ", " },
      { text: "italic", italic: true },
      { text: " and " },
      { text: "under", underline: true },
      { text: "." },
    ],
  },
  {
    type: "ul",
    children: [
      { type: "li", children: [{ type: "lic", children: [{ text: "one" }] }] },
      { type: "li", children: [{ type: "lic", children: [{ text: "two" }] }] },
    ],
  },
  {
    type: "ol",
    children: [
      { type: "li", children: [{ type: "lic", children: [{ text: "first" }] }] },
    ],
  },
  {
    type: "table",
    children: [
      {
        type: "tr",
        children: [
          { type: "th", children: [{ type: "p", children: [{ text: "H1" }] }] },
          { type: "th", children: [{ type: "p", children: [{ text: "H2" }] }] },
        ],
      },
      {
        type: "tr",
        children: [
          { type: "td", children: [{ type: "p", children: [{ text: "A" }] }] },
          { type: "td", children: [{ type: "p", children: [{ text: "B" }] }] },
        ],
      },
    ],
  },
];

const EXPECTED_HTML = [
  "<h1>Agreement</h1>",
  "<h2>Section</h2>",
  "<h3>Clause</h3>",
  "<p>This is <strong>bold</strong>, <em>italic</em> and <u>under</u>.</p>",
  "<ul><li>one</li><li>two</li></ul>",
  "<ol><li>first</li></ol>",
  "<table><tr><th>H1</th><th>H2</th></tr><tr><td>A</td><td>B</td></tr></table>",
].join("\n");

describe("valueToHtml", () => {
  it("serializes headings, paragraphs, marks, lists and tables to clean HTML", () => {
    expect(valueToHtml(NORMALIZED_VALUE)).toBe(EXPECTED_HTML);
  });

  it("escapes HTML-unsafe characters in text content", () => {
    const value: SerializableNode[] = [
      { type: "p", children: [{ text: "a < b && c > d" }] },
    ];
    expect(valueToHtml(value)).toBe("<p>a &lt; b &amp;&amp; c &gt; d</p>");
  });

  it("collapses raw (li>text) and normalized (li>lic>text) lists to identical HTML", () => {
    const raw: SerializableNode[] = [
      { type: "ul", children: [{ type: "li", children: [{ text: "one" }] }] },
    ];
    const normalized: SerializableNode[] = [
      {
        type: "ul",
        children: [
          { type: "li", children: [{ type: "lic", children: [{ text: "one" }] }] },
        ],
      },
    ];
    expect(valueToHtml(raw)).toBe("<ul><li>one</li></ul>");
    expect(valueToHtml(normalized)).toBe("<ul><li>one</li></ul>");
  });

  it("collapses raw (td>text) and normalized (td>p>text) cells to identical HTML", () => {
    const raw: SerializableNode[] = [
      {
        type: "table",
        children: [{ type: "tr", children: [{ type: "td", children: [{ text: "X" }] }] }],
      },
    ];
    const normalized: SerializableNode[] = [
      {
        type: "table",
        children: [
          {
            type: "tr",
            children: [
              { type: "td", children: [{ type: "p", children: [{ text: "X" }] }] },
            ],
          },
        ],
      },
    ];
    expect(valueToHtml(raw)).toBe("<table><tr><td>X</td></tr></table>");
    expect(valueToHtml(normalized)).toBe("<table><tr><td>X</td></tr></table>");
  });

  it("nests combined marks deterministically (bold > italic > underline)", () => {
    const value: SerializableNode[] = [
      {
        type: "p",
        children: [{ text: "x", bold: true, italic: true, underline: true }],
      },
    ];
    expect(valueToHtml(value)).toBe("<p><strong><em><u>x</u></em></strong></p>");
  });

  // The advisor's required gate: a custom serializer paired with Plate's built-in
  // deserializer must round-trip stably, or content can silently drift/vanish in
  // a signed legal document.
  it("round-trips stably: valueToHtml -> deserialize -> valueToHtml is identical", () => {
    const html1 = valueToHtml(NORMALIZED_VALUE);
    const reparsed = deserialize(html1);
    const html2 = valueToHtml(reparsed);
    expect(html2).toBe(html1);
  });
});
