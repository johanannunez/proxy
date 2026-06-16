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
 */

type TextLeaf = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

type ElementNode = {
  type?: string;
  children: SerializableNode[];
};

export type SerializableNode = TextLeaf | ElementNode;

function isText(node: SerializableNode): node is TextLeaf {
  return typeof (node as TextLeaf).text === "string";
}

function isElement(node: SerializableNode): node is ElementNode {
  return Array.isArray((node as ElementNode).children);
}

/** Escapes the three characters that are unsafe in HTML text content. We never
 *  emit dynamic attributes, so quotes do not need escaping. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Renders a single text leaf, applying marks in a fixed outer-to-inner order
 *  (bold > italic > underline) so the round-trip is deterministic. */
function renderLeaf(leaf: TextLeaf): string {
  // Apply marks inner-to-outer so the nesting reads bold > italic > underline
  // (bold outermost). Deterministic ordering keeps the round-trip stable.
  let html = escapeHtml(leaf.text);
  if (leaf.underline) html = `<u>${html}</u>`;
  if (leaf.italic) html = `<em>${html}</em>`;
  if (leaf.bold) html = `<strong>${html}</strong>`;
  return html;
}

/** Renders inline children (text leaves; defensively unwraps any element found
 *  in inline position rather than dropping its content). */
function renderInline(children: SerializableNode[]): string {
  return children
    .map((child) =>
      isText(child) ? renderLeaf(child) : renderInline(child.children),
    )
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
  return `<li>${inline}${nested}</li>`;
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

  switch (node.type) {
    case "h1":
    case "h2":
    case "h3":
      return `<${node.type}>${renderInline(node.children)}</${node.type}>`;
    case "p":
      return `<p>${renderInline(node.children)}</p>`;
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
