"use client";

import type { ReactNode } from "react";
import DOMPurify from "dompurify";

/**
 * Renders help article content. Detects format automatically:
 * - HTML content (from Tiptap editor): rendered in a styled prose container
 * - Markdown content (legacy articles): parsed with the custom parser
 *
 * All content is admin-authored.
 */
export function ArticleRenderer({ content }: { content: string }) {
  const trimmed = content.trim();

  /* HTML content from Tiptap editor */
  if (trimmed.startsWith("<")) {
    const clean = DOMPurify.sanitize(trimmed);
    return (
      <div
        className="article-renderer-html prose prose-sm max-w-none
          [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-[var(--color-text-primary)]
          [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-[var(--color-text-primary)]
          [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--color-text-primary)]
          [&_p]:text-[15px] [&_p]:leading-[1.75] [&_p]:text-[var(--color-text-secondary)]
          [&_ul]:pl-5 [&_ul]:text-[15px] [&_ul]:leading-[1.75] [&_ul]:text-[var(--color-text-secondary)]
          [&_ol]:pl-5 [&_ol]:text-[15px] [&_ol]:leading-[1.75] [&_ol]:text-[var(--color-text-secondary)]
          [&_li]:mb-1
          [&_a]:text-[var(--color-brand)] [&_a]:underline [&_a]:underline-offset-2
          [&_strong]:font-semibold [&_strong]:text-[var(--color-text-primary)]
          [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--color-brand-light)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--color-text-secondary)]
          [&_code]:rounded-md [&_code]:bg-[var(--color-warm-gray-100)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:font-mono
          [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[var(--color-warm-gray-200)] [&_pre]:bg-[var(--color-warm-gray-50)] [&_pre]:px-4 [&_pre]:py-4 [&_pre]:text-[13px] [&_pre]:font-mono [&_pre]:overflow-x-auto
          [&_hr]:border-[var(--color-warm-gray-100)] [&_hr]:my-8
          [&_img]:rounded-xl [&_img]:border [&_img]:border-[var(--color-warm-gray-200)] [&_img]:shadow-sm [&_img]:my-4
          [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse
          [&_th]:border [&_th]:border-[var(--color-warm-gray-200)] [&_th]:bg-[var(--color-warm-gray-50)] [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-[var(--color-text-tertiary)]
          [&_td]:border [&_td]:border-[var(--color-warm-gray-200)] [&_td]:px-4 [&_td]:py-2 [&_td]:text-[13px] [&_td]:text-[var(--color-text-secondary)]"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }

  /* Legacy markdown content */
  const blocks = parseBlocks(content);

  return (
    <div className="article-renderer flex flex-col gap-5">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type BlockNode =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; language: string; code: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "image"; alt: string; src: string };

/* ------------------------------------------------------------------ */
/*  Block parser                                                       */
/* ------------------------------------------------------------------ */

function parseBlocks(md: string): BlockNode[] {
  const lines = md.split("\n");
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    /* Fenced code block */
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", language, code: codeLines.join("\n") });
      i++; /* skip closing ``` */
      continue;
    }

    /* Heading ## */
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i++;
      continue;
    }

    /* Heading ### */
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      i++;
      continue;
    }

    /* Image: ![alt](url) */
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imgMatch) {
      blocks.push({ type: "image", alt: imgMatch[1], src: imgMatch[2] });
      i++;
      continue;
    }

    /* Unordered list */
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, "").trim());
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    /* Table */
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      /^[\s|:-]+$/.test(lines[i + 1])
    ) {
      const headers = parsePipeLine(line);
      i += 2; /* skip header + separator */
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(parsePipeLine(lines[i]));
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    /* Empty line */
    if (line.trim() === "") {
      i++;
      continue;
    }

    /* Paragraph (collect consecutive non-blank, non-special lines) */
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("## ") &&
      !lines[i].startsWith("### ") &&
      !lines[i].startsWith("```") &&
      !/^[-*] /.test(lines[i]) &&
      !(
        lines[i].includes("|") &&
        i + 1 < lines.length &&
        /^[\s|:-]+$/.test(lines[i + 1])
      )
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join(" ") });
    }
  }

  return blocks;
}

function parsePipeLine(line: string): string[] {
  return line
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/* ------------------------------------------------------------------ */
/*  Inline parser                                                      */
/* ------------------------------------------------------------------ */

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  /* Pattern matches: **bold**, *italic*, `code`, [text](url) */
  const regex =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+?)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    /* Push preceding plain text */
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      /* Bold */
      nodes.push(
        <strong
          key={match.index}
          className="font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      /* Italic */
      nodes.push(
        <em key={match.index} className="italic">
          {match[4]}
        </em>
      );
    } else if (match[5]) {
      /* Inline code */
      nodes.push(
        <code
          key={match.index}
          className="rounded-md px-1.5 py-0.5 text-[13px] font-mono"
          style={{
            backgroundColor: "var(--color-warm-gray-100)",
            color: "var(--color-text-primary)",
          }}
        >
          {match[6]}
        </code>
      );
    } else if (match[7]) {
      /* Link */
      nodes.push(
        <a
          key={match.index}
          href={match[9]}
          className="font-medium underline decoration-1 underline-offset-2 transition-colors duration-150 hover:decoration-2"
          style={{ color: "var(--color-brand)" }}
          target={match[9].startsWith("http") ? "_blank" : undefined}
          rel={
            match[9].startsWith("http") ? "noopener noreferrer" : undefined
          }
        >
          {match[8]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/* ------------------------------------------------------------------ */
/*  Block renderer                                                     */
/* ------------------------------------------------------------------ */

function Block({ block }: { block: BlockNode }) {
  switch (block.type) {
    case "h2":
      return (
        <h2
          className="mt-4 text-xl font-bold leading-snug tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {renderInline(block.text)}
        </h2>
      );

    case "h3":
      return (
        <h3
          className="mt-2 text-base font-semibold leading-snug tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {renderInline(block.text)}
        </h3>
      );

    case "paragraph":
      return (
        <p
          className="text-[15px] leading-[1.75]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {renderInline(block.text)}
        </p>
      );

    case "list":
      return (
        <ul className="flex flex-col gap-2 pl-5">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="list-disc text-[15px] leading-[1.75]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );

    case "code":
      return (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          {block.language && (
            <div
              className="border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: "var(--color-warm-gray-50)",
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-tertiary)",
              }}
            >
              {block.language}
            </div>
          )}
          <pre
            className="overflow-x-auto px-4 py-4 text-[13px] leading-relaxed font-mono"
            style={{
              backgroundColor: "var(--color-warm-gray-50)",
              color: "var(--color-text-primary)",
            }}
          >
            <code>{block.code}</code>
          </pre>
        </div>
      );

    case "image":
      return (
        <figure className="my-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.src}
            alt={block.alt}
            className="w-full rounded-xl border shadow-sm"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
            loading="lazy"
          />
          {block.alt && (
            <figcaption
              className="mt-2 text-center text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {block.alt}
            </figcaption>
          )}
        </figure>
      );

    case "table":
      return (
        <div
          className="overflow-x-auto rounded-xl border"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--color-warm-gray-50)",
                }}
              >
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{
                      color: "var(--color-text-tertiary)",
                      borderBottom: "1px solid var(--color-warm-gray-200)",
                    }}
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr
                  key={ri}
                  style={{
                    borderBottom:
                      ri < block.rows.length - 1
                        ? "1px solid var(--color-warm-gray-200)"
                        : "none",
                  }}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-4 py-3 text-[13px] leading-relaxed"
                      style={{
                        color: "var(--color-text-secondary)",
                        backgroundColor: "var(--color-white)",
                      }}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
