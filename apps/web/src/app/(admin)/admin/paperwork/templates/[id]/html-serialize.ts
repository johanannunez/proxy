/**
 * valueToHtml — deterministic, dependency-free serializer from a Plate v53
 * editor Value to a clean, semantic HTML fragment.
 *
 * Why hand-written instead of Plate's `serializeHtml` (platejs/static):
 * the output of this editor is a LEGAL DOCUMENT that gets pushed to DocuSeal
 * for signing. We need auditable, predictable markup (`<h1>`, `<p>`, `<strong>`,
 * `<ul>/<li>`, `<table>`) that exactly matches the document-shell CSS, with no
 * Slate class names, data attributes, or async static-render machinery.
 *
 * Node-type strings and mark keys below are NOT guessed — they are the live
 * `KEYS` values from the installed `platejs@53` plus the real node shapes that
 * `editor.api.html.deserialize` and the editor normalizers produce (verified by
 * the round-trip test in `__tests__/html-serialize.test.ts`). The two shapes the
 * serializer must reconcile:
 *   - raw deserialize:  ul > li > text          | table > tr > td/th > text
 *   - normalized editor: ul > li > lic > text   | table > tr > td/th > p > text
 * Both must serialize to the SAME HTML so the round-trip is stable.
 *
 * Verified prop names (from jsdom probe against installed @platejs/* packages):
 *   Mark keys:   strikethrough, code, superscript, subscript
 *   Style marks: color, backgroundColor, fontFamily, fontSize, fontWeight
 *   Block align: node.align  (BaseTextAlignPlugin — NOT "textAlign")
 *   lineHeight:  node.lineHeight
 *   Link:        type "a", prop "url"
 *   Img:         type "img", prop "url" (alt not preserved by deserializer)
 *   code_block:  type "code_block", children are type "code_line"
 *   checklist li: type "li" with prop "checked" (boolean)
 *   page_break:  type "page_break" (custom void block, no standard plugin)
 */

type TextLeaf = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  // Style marks
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
};

type ElementNode = {
  type?: string;
  children: SerializableNode[];
  // Block style attributes
  align?: string;
  lineHeight?: string;
  // Checklist
  checked?: boolean;
  // Link
  url?: string;
  // Image
  src?: string;
  alt?: string;
};

export type SerializableNode = TextLeaf | ElementNode;

function isText(node: SerializableNode): node is TextLeaf {
  return typeof (node as TextLeaf).text === "string";
}

function isElement(node: SerializableNode): node is ElementNode {
  return Array.isArray((node as ElementNode).children);
}

/** Escapes the three characters that are unsafe in HTML text content. We never
 *  emit dynamic attributes, so quotes do not need escaping in text nodes. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escapes a value for use inside an HTML attribute (double-quoted). */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Builds a style string from style-mark props on a text leaf. Returns the
 * style attribute value (e.g. "color:rgb(255,0,0);font-size:18px") or "" if
 * no style props are present. Order is fixed and deterministic for stable
 * round-trips.
 */
function leafStyleAttr(leaf: TextLeaf): string {
  const parts: string[] = [];
  // Deterministic order: color, background-color, font-family, font-size, font-weight
  if (leaf.color) parts.push(`color:${leaf.color}`);
  if (leaf.backgroundColor) parts.push(`background-color:${leaf.backgroundColor}`);
  if (leaf.fontFamily) parts.push(`font-family:${leaf.fontFamily}`);
  if (leaf.fontSize) parts.push(`font-size:${leaf.fontSize}`);
  if (leaf.fontWeight) parts.push(`font-weight:${leaf.fontWeight}`);
  return parts.join(";");
}

/**
 * Builds a style attribute string for a block element from its block-level
 * style props (align, lineHeight). Returns ` style="..."` with a leading space
 * (ready to splice into a tag opening), or "" if no props apply.
 */
function blockStyleAttr(node: ElementNode): string {
  const parts: string[] = [];
  if (node.align) parts.push(`text-align:${node.align}`);
  if (node.lineHeight) parts.push(`line-height:${node.lineHeight}`);
  if (parts.length === 0) return "";
  return ` style="${parts.join(";")}"`;
}

/** Renders a single text leaf, applying marks in a fixed outer-to-inner order.
 *
 *  Outer wrapping order (outermost → innermost):
 *    span[style] > strong > em > u > s > code > sup > sub
 *
 *  Style-mark props (color/backgroundColor/fontFamily/fontSize/fontWeight) are
 *  combined into a single <span style="..."> wrapping all other marks, so a
 *  leaf with bold+color produces <span style="color:..."><strong>text</strong></span>.
 *  This is the only stable serialization because the HTML deserializer merges
 *  all ancestor inline styles into a single leaf regardless of nesting order.
 */
function renderLeaf(leaf: TextLeaf): string {
  let html = escapeHtml(leaf.text);
  // Inner-to-outer: last applied becomes outermost
  if (leaf.subscript) html = `<sub>${html}</sub>`;
  if (leaf.superscript) html = `<sup>${html}</sup>`;
  if (leaf.code) html = `<code>${html}</code>`;
  if (leaf.strikethrough) html = `<s>${html}</s>`;
  if (leaf.underline) html = `<u>${html}</u>`;
  if (leaf.italic) html = `<em>${html}</em>`;
  if (leaf.bold) html = `<strong>${html}</strong>`;
  const styleVal = leafStyleAttr(leaf);
  if (styleVal) html = `<span style="${escapeAttr(styleVal)}">${html}</span>`;
  return html;
}

/** Renders inline children (text leaves; defensively unwraps any element found
 *  in inline position rather than dropping its content). */
function renderInline(children: SerializableNode[]): string {
  return children
    .map((child) => {
      if (isText(child)) return renderLeaf(child);
      if (isElement(child)) {
        // Inline element: link (type "a")
        if (child.type === "a") {
          const href = child.url ? ` href="${escapeAttr(child.url)}"` : "";
          return `<a${href}>${renderInline(child.children)}</a>`;
        }
        return renderInline(child.children);
      }
      return "";
    })
    .join("");
}

/** Collects the inline content of a node's children, treating block wrappers
 *  (`lic`, `p`) as transparent. Used inside list items and table cells where the
 *  editor wraps text in a block but the HTML should stay inline. */
function inlineFromChildren(children: SerializableNode[]): string {
  return children
    .map((child) => {
      if (isText(child)) return renderLeaf(child);
      if (child.type === "lic" || child.type === "p") {
        return renderInline(child.children);
      }
      return renderInline(child.children);
    })
    .join("");
}

function renderListItem(item: SerializableNode): string {
  if (!isElement(item)) return `<li>${isText(item) ? renderLeaf(item) : ""}</li>`;

  let inline = "";
  let nested = "";
  for (const child of item.children) {
    if (isText(child)) {
      inline += renderLeaf(child);
    } else if (child.type === "lic" || child.type === "p") {
      inline += renderInline(child.children);
    } else if (child.type === "ul" || child.type === "ol") {
      nested += renderBlock(child);
    } else {
      // Unknown block inside a list item: keep its content as a nested block
      // rather than dropping it.
      nested += renderBlock(child);
    }
  }

  // Checklist: emit data-checked when the li carries the `checked` prop
  const checkedAttr =
    (item as ElementNode).checked === true
      ? ' data-checked="true"'
      : (item as ElementNode).checked === false
        ? ' data-checked="false"'
        : "";
  return `<li${checkedAttr}>${inline}${nested}</li>`;
}

function renderTableCell(cell: SerializableNode): string {
  const tag = isElement(cell) && cell.type === "th" ? "th" : "td";
  if (!isElement(cell)) return `<${tag}></${tag}>`;

  // Cell children are either text (raw) or block(s) (normalized: p). Join the
  // inline content of each block child; multiple blocks are separated by a line
  // break so multi-paragraph cells survive.
  const parts: string[] = [];
  for (const child of cell.children) {
    if (isText(child)) {
      parts.push(renderLeaf(child));
    } else {
      parts.push(renderInline(child.children));
    }
  }
  return `<${tag}>${parts.filter((p) => p.length > 0).join("<br />")}</${tag}>`;
}

function renderTableRow(row: SerializableNode): string {
  if (!isElement(row)) return "";
  return `<tr>${row.children.map(renderTableCell).join("")}</tr>`;
}

function renderBlock(node: SerializableNode): string {
  if (!isElement(node)) {
    // A bare text node at block level: wrap it so no content is lost.
    return isText(node) ? `<p>${renderLeaf(node)}</p>` : "";
  }

  const style = blockStyleAttr(node);

  switch (node.type) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return `<${node.type}${style}>${renderInline(node.children)}</${node.type}>`;
    case "p":
      return `<p${style}>${renderInline(node.children)}</p>`;
    case "blockquote":
      // blockquote children may be raw text or block(s) (p). Render children
      // as blocks; a plain-text child is transparently wrapped.
      return `<blockquote${style}>${node.children.map(renderBlock).join("")}</blockquote>`;
    case "code_block": {
      // code_block children are code_line elements, one per line.
      const lines = node.children
        .map((child) => {
          if (isText(child)) return escapeHtml(child.text);
          if (isElement(child)) return renderInline(child.children);
          return "";
        })
        .join("\n");
      return `<pre><code>${lines}</code></pre>`;
    }
    case "hr":
      return `<hr />`;
    case "page_break":
      return `<div class="page-break"></div>`;
    case "img": {
      const src = node.url ?? (node as ElementNode & { src?: string }).src ?? "";
      const alt = (node as ElementNode).alt ?? "";
      return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" />`;
    }
    case "ul":
      return `<ul>${node.children.map(renderListItem).join("")}</ul>`;
    case "ol":
      return `<ol>${node.children.map(renderListItem).join("")}</ol>`;
    case "table":
      return `<table>${node.children.map(renderTableRow).join("")}</table>`;
    default: {
      // Unknown block type. If it wraps block children, render them as blocks;
      // otherwise treat its content as inline inside a paragraph. Either way no
      // content is silently dropped.
      const hasBlockChildren = node.children.some(
        (child) => isElement(child) && typeof child.type === "string",
      );
      if (hasBlockChildren) {
        return node.children.map(renderBlock).join("");
      }
      const inline = inlineFromChildren(node.children);
      return inline ? `<p>${inline}</p>` : "";
    }
  }
}

/**
 * Serializes a Plate editor Value (array of top-level nodes) to an HTML
 * fragment. Top-level blocks are joined with newlines for a readable stored
 * fragment; the whitespace between block tags is insignificant and round-trips
 * cleanly through `editor.api.html.deserialize`.
 */
export function valueToHtml(nodes: SerializableNode[]): string {
  return nodes.map(renderBlock).join("\n");
}
