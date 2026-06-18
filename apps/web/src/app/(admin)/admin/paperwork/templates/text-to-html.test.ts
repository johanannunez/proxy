import { describe, it, expect } from "vitest";
import { textToHtml, escapeHtml } from "./text-to-html";

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
  });
});

describe("textToHtml", () => {
  it("wraps the title in an h1 and each blank-line block in a paragraph", () => {
    expect(textToHtml("My Doc", "Para one.\n\nPara two.")).toBe(
      "<h1>My Doc</h1><p>Para one.</p><p>Para two.</p>",
    );
  });
  it("turns single newlines into <br>", () => {
    expect(textToHtml("T", "line a\nline b")).toBe(
      "<h1>T</h1><p>line a<br>line b</p>",
    );
  });
  it("escapes user content", () => {
    expect(textToHtml("A & B", "<script>")).toBe(
      "<h1>A &amp; B</h1><p>&lt;script&gt;</p>",
    );
  });
});
