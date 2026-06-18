// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { createSlateEditor, createSlatePlugin } from "platejs";
import {
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseH4Plugin,
  BaseH5Plugin,
  BaseH6Plugin,
  BaseBlockquotePlugin,
  BaseStrikethroughPlugin,
  BaseCodePlugin,
  BaseSuperscriptPlugin,
  BaseSubscriptPlugin,
  BaseHorizontalRulePlugin,
} from "@platejs/basic-nodes";
import {
  BaseFontColorPlugin,
  BaseFontBackgroundColorPlugin,
  BaseFontFamilyPlugin,
  BaseFontSizePlugin,
  BaseFontWeightPlugin,
  BaseTextAlignPlugin,
  BaseLineHeightPlugin,
} from "@platejs/basic-styles";
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
import { BaseCodeBlockPlugin, BaseCodeLinePlugin } from "@platejs/code-block";
import { BaseLinkPlugin } from "@platejs/link";
import { BaseImagePlugin } from "@platejs/media";
import { valueToHtml, type SerializableNode } from "../html-serialize";

/**
 * A minimal custom plugin that deserializes `<div class="page-break">` back
 * to `{type:"page_break"}`. The serializer emits this exact HTML; without
 * this custom rule, the div collapses to an empty text leaf and the round-trip
 * fails. This mirrors what a real production page_break plugin would provide.
 */
const BasePageBreakPlugin = createSlatePlugin({
  key: "page_break",
  node: { isElement: true, isVoid: true },
  parsers: {
    html: {
      deserializer: {
        rules: [
          {
            validNodeName: "DIV",
            validClassName: "page-break",
          },
        ],
        parse: () => ({ type: "page_break" }),
      },
    },
  },
});

/**
 * A minimal custom plugin that deserializes `<li data-checked="true/false">`
 * back to `{type:"li", checked: boolean}`. Without this, the `data-checked`
 * attribute is ignored and the round-trip for checklists silently loses state.
 */
const BaseCheckedListItemPlugin = createSlatePlugin({
  key: "checked_li_deserializer",
  node: { isElement: true },
  parsers: {
    html: {
      deserializer: {
        rules: [
          {
            validNodeName: "LI",
            validAttribute: { "data-checked": ["true", "false"] },
          },
        ],
        parse: ({ element }) => ({
          type: "li",
          checked: element.getAttribute("data-checked") === "true",
        }),
      },
    },
  },
});

const PLUGINS = [
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseH4Plugin,
  BaseH5Plugin,
  BaseH6Plugin,
  BaseBlockquotePlugin,
  BaseStrikethroughPlugin,
  BaseCodePlugin,
  BaseSuperscriptPlugin,
  BaseSubscriptPlugin,
  BaseHorizontalRulePlugin,
  BaseFontColorPlugin,
  BaseFontBackgroundColorPlugin,
  BaseFontFamilyPlugin,
  BaseFontSizePlugin,
  BaseFontWeightPlugin,
  BaseTextAlignPlugin,
  BaseLineHeightPlugin,
  BaseListPlugin,
  BaseBulletedListPlugin,
  BaseNumberedListPlugin,
  BaseListItemPlugin,
  BaseListItemContentPlugin,
  BaseTablePlugin,
  BaseTableRowPlugin,
  BaseTableCellPlugin,
  BaseTableCellHeaderPlugin,
  BaseCodeBlockPlugin,
  BaseCodeLinePlugin,
  BaseLinkPlugin,
  BaseImagePlugin,
  BasePageBreakPlugin,
  BaseCheckedListItemPlugin,
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

  // -------------------------------------------------------------------------
  // New marks: strikethrough, code (inline), superscript, subscript
  // -------------------------------------------------------------------------

  it("serializes strikethrough mark to <s>", () => {
    const value: SerializableNode[] = [
      { type: "p", children: [{ text: "struck", strikethrough: true }] },
    ];
    expect(valueToHtml(value)).toBe("<p><s>struck</s></p>");
  });

  it("serializes inline code mark to <code>", () => {
    const value: SerializableNode[] = [
      { type: "p", children: [{ text: "code", code: true }] },
    ];
    expect(valueToHtml(value)).toBe("<p><code>code</code></p>");
  });

  it("serializes superscript mark to <sup>", () => {
    const value: SerializableNode[] = [
      { type: "p", children: [{ text: "sup", superscript: true }] },
    ];
    expect(valueToHtml(value)).toBe("<p><sup>sup</sup></p>");
  });

  it("serializes subscript mark to <sub>", () => {
    const value: SerializableNode[] = [
      { type: "p", children: [{ text: "sub", subscript: true }] },
    ];
    expect(valueToHtml(value)).toBe("<p><sub>sub</sub></p>");
  });

  // -------------------------------------------------------------------------
  // Style marks: color, backgroundColor, fontFamily, fontSize, fontWeight
  // Note: color values use rgb() format because that is what the HTML deserializer
  // produces from both hex and rgb() input (browser normalizes to rgb()).
  // -------------------------------------------------------------------------

  it("serializes color style mark to <span style='color:...'>", () => {
    const value: SerializableNode[] = [
      { type: "p", children: [{ text: "red", color: "rgb(255, 0, 0)" }] },
    ];
    expect(valueToHtml(value)).toBe(
      '<p><span style="color:rgb(255, 0, 0)">red</span></p>',
    );
  });

  it("serializes backgroundColor style mark", () => {
    const value: SerializableNode[] = [
      { type: "p", children: [{ text: "bg", backgroundColor: "rgb(0, 255, 0)" }] },
    ];
    expect(valueToHtml(value)).toBe(
      '<p><span style="background-color:rgb(0, 255, 0)">bg</span></p>',
    );
  });

  it("serializes fontFamily style mark", () => {
    const value: SerializableNode[] = [
      { type: "p", children: [{ text: "fam", fontFamily: "Arial" }] },
    ];
    expect(valueToHtml(value)).toBe(
      '<p><span style="font-family:Arial">fam</span></p>',
    );
  });

  it("serializes fontSize style mark", () => {
    const value: SerializableNode[] = [
      { type: "p", children: [{ text: "big", fontSize: "18px" }] },
    ];
    expect(valueToHtml(value)).toBe(
      '<p><span style="font-size:18px">big</span></p>',
    );
  });

  it("serializes fontWeight style mark", () => {
    const value: SerializableNode[] = [
      { type: "p", children: [{ text: "heavy", fontWeight: "900" }] },
    ];
    expect(valueToHtml(value)).toBe(
      '<p><span style="font-weight:900">heavy</span></p>',
    );
  });

  it("combines multiple style marks into one <span style='...'>", () => {
    const value: SerializableNode[] = [
      {
        type: "p",
        children: [
          {
            text: "styled",
            color: "rgb(255, 0, 0)",
            fontSize: "18px",
            fontWeight: "700",
          },
        ],
      },
    ];
    expect(valueToHtml(value)).toBe(
      '<p><span style="color:rgb(255, 0, 0);font-size:18px;font-weight:700">styled</span></p>',
    );
  });

  it("wraps style span outside bold when both are present", () => {
    const value: SerializableNode[] = [
      {
        type: "p",
        children: [{ text: "bold-red", bold: true, color: "rgb(255, 0, 0)" }],
      },
    ];
    expect(valueToHtml(value)).toBe(
      '<p><span style="color:rgb(255, 0, 0)"><strong>bold-red</strong></span></p>',
    );
  });

  // -------------------------------------------------------------------------
  // New block types: h4/h5/h6, blockquote, code_block, hr
  // -------------------------------------------------------------------------

  it("serializes h4, h5, h6 headings", () => {
    const value: SerializableNode[] = [
      { type: "h4", children: [{ text: "Four" }] },
      { type: "h5", children: [{ text: "Five" }] },
      { type: "h6", children: [{ text: "Six" }] },
    ];
    expect(valueToHtml(value)).toBe("<h4>Four</h4>\n<h5>Five</h5>\n<h6>Six</h6>");
  });

  it("serializes blockquote block", () => {
    const value: SerializableNode[] = [
      {
        type: "blockquote",
        children: [{ type: "p", children: [{ text: "quote text" }] }],
      },
    ];
    expect(valueToHtml(value)).toBe("<blockquote><p>quote text</p></blockquote>");
  });

  it("serializes code_block with multiple code_line children to <pre><code>", () => {
    const value: SerializableNode[] = [
      {
        type: "code_block",
        children: [
          { type: "code_line", children: [{ text: "line1" }] },
          { type: "code_line", children: [{ text: "line2" }] },
        ],
      },
    ];
    expect(valueToHtml(value)).toBe("<pre><code>line1\nline2</code></pre>");
  });

  it("serializes hr block to <hr />", () => {
    const value: SerializableNode[] = [
      { type: "hr", children: [{ text: "" }] },
    ];
    expect(valueToHtml(value)).toBe("<hr />");
  });

  // -------------------------------------------------------------------------
  // Block style attributes: text-align and line-height
  // -------------------------------------------------------------------------

  it("serializes text-align on paragraph via style attribute", () => {
    const value: SerializableNode[] = [
      { type: "p", align: "center", children: [{ text: "centered" }] },
    ];
    expect(valueToHtml(value)).toBe('<p style="text-align:center">centered</p>');
  });

  it("serializes lineHeight on paragraph via style attribute", () => {
    const value: SerializableNode[] = [
      { type: "p", lineHeight: "2", children: [{ text: "spaced" }] },
    ];
    expect(valueToHtml(value)).toBe('<p style="line-height:2">spaced</p>');
  });

  it("combines text-align and line-height in one style attribute", () => {
    const value: SerializableNode[] = [
      {
        type: "p",
        align: "right",
        lineHeight: "1.5",
        children: [{ text: "right-spaced" }],
      },
    ];
    expect(valueToHtml(value)).toBe(
      '<p style="text-align:right;line-height:1.5">right-spaced</p>',
    );
  });

  // -------------------------------------------------------------------------
  // Links
  // -------------------------------------------------------------------------

  it("serializes link inline element to <a href='...'>", () => {
    const value: SerializableNode[] = [
      {
        type: "p",
        children: [
          {
            type: "a",
            url: "https://example.com",
            children: [{ text: "link text" }],
          },
        ],
      },
    ];
    expect(valueToHtml(value)).toBe(
      '<p><a href="https://example.com">link text</a></p>',
    );
  });

  // -------------------------------------------------------------------------
  // Checklist
  // -------------------------------------------------------------------------

  it("serializes checked list items with data-checked attribute", () => {
    const value: SerializableNode[] = [
      {
        type: "ul",
        children: [
          {
            type: "li",
            checked: true,
            children: [{ type: "lic", children: [{ text: "done" }] }],
          },
          {
            type: "li",
            checked: false,
            children: [{ type: "lic", children: [{ text: "todo" }] }],
          },
        ],
      },
    ];
    expect(valueToHtml(value)).toBe(
      '<ul><li data-checked="true">done</li><li data-checked="false">todo</li></ul>',
    );
  });

  // -------------------------------------------------------------------------
  // Page break
  // -------------------------------------------------------------------------

  it("serializes page_break to <div class='page-break'>", () => {
    const value: SerializableNode[] = [{ type: "page_break", children: [{ text: "" }] }];
    expect(valueToHtml(value)).toBe('<div class="page-break"></div>');
  });

  // -------------------------------------------------------------------------
  // Image
  // -------------------------------------------------------------------------

  it("serializes img block to <img src='...' alt='...' />", () => {
    const value: SerializableNode[] = [
      {
        type: "img",
        url: "https://example.com/photo.jpg",
        alt: "A photo",
        children: [{ text: "" }],
      },
    ];
    expect(valueToHtml(value)).toBe(
      '<img src="https://example.com/photo.jpg" alt="A photo" />',
    );
  });

  // -------------------------------------------------------------------------
  // Comprehensive round-trip test: every new mark and block type
  //
  // Value must be in the CANONICAL post-deserialize form so that
  // valueToHtml(value) === valueToHtml(deserialize(valueToHtml(value))).
  //
  // Canonical shapes verified against live jsdom probe:
  //   - color / backgroundColor: rgb() string format (browser normalizes hex)
  //   - fontWeight: string "900"
  //   - fontSize: string "18px"
  //   - fontFamily: string "Arial"
  //   - lineHeight: string "2"
  //   - align: "center" (prop name is "align", not "textAlign")
  //   - link: type "a", prop "url"
  //   - img: type "img", prop "url" (alt is not preserved by Plate deserializer)
  //   - code_block children: type "code_line"
  //   - checklist li: prop "checked" (boolean)
  //   - page_break: requires custom BasePageBreakPlugin in test deserializer
  // -------------------------------------------------------------------------
  it("comprehensive round-trip: all new marks and blocks are stable", () => {
    const COMPREHENSIVE_VALUE: SerializableNode[] = [
      // h4/h5/h6
      { type: "h4", children: [{ text: "Heading 4" }] },
      { type: "h5", children: [{ text: "Heading 5" }] },
      { type: "h6", children: [{ text: "Heading 6" }] },
      // strikethrough
      { type: "p", children: [{ text: "struck", strikethrough: true }] },
      // inline code
      { type: "p", children: [{ text: "code", code: true }] },
      // superscript and subscript
      { type: "p", children: [{ text: "sup", superscript: true }, { text: " and " }, { text: "sub", subscript: true }] },
      // style marks (rgb format for stable round-trip)
      {
        type: "p",
        children: [
          { text: "colored", color: "rgb(255, 0, 0)" },
          { text: " " },
          { text: "bg", backgroundColor: "rgb(0, 255, 0)" },
          { text: " " },
          { text: "arial", fontFamily: "Arial" },
          { text: " " },
          { text: "big", fontSize: "18px" },
          { text: " " },
          { text: "heavy", fontWeight: "900" },
        ],
      },
      // blockquote (normalized: blockquote > p > text)
      {
        type: "blockquote",
        children: [{ type: "p", children: [{ text: "a quoted passage" }] }],
      },
      // code_block with two lines
      {
        type: "code_block",
        children: [
          { type: "code_line", children: [{ text: "const x = 1;" }] },
          { type: "code_line", children: [{ text: "return x;" }] },
        ],
      },
      // hr
      { type: "hr", children: [{ text: "" }] },
      // aligned + line-height paragraph
      {
        type: "p",
        align: "center",
        lineHeight: "2",
        children: [{ text: "centered and spaced" }],
      },
      // link
      {
        type: "p",
        children: [
          {
            type: "a",
            url: "https://example.com",
            children: [{ text: "click here" }],
          },
        ],
      },
      // checklist with one checked item
      {
        type: "ul",
        children: [
          {
            type: "li",
            checked: true,
            children: [{ type: "lic", children: [{ text: "done item" }] }],
          },
          {
            type: "li",
            checked: false,
            children: [{ type: "lic", children: [{ text: "pending item" }] }],
          },
        ],
      },
      // page_break
      { type: "page_break", children: [{ text: "" }] },
    ];

    const html1 = valueToHtml(COMPREHENSIVE_VALUE);
    const reparsed = deserialize(html1);
    const html2 = valueToHtml(reparsed);
    expect(html2).toBe(html1);
  });
});
