// Pure module — no DOM, no React. Builds the srcdoc string for the Paged.js
// preview iframe. Import-safe in client components.

import {
  DOCUMENT_TYPOGRAPHY_CSS,
  usedFontImports,
} from "../../document-shell";

/**
 * Builds a complete HTML document that Paged.js will paginate into US-Letter
 * pages (8.5in × 11in). Safe to assign directly to `iframe.srcdoc`.
 *
 * The PagedConfig object MUST be defined before the polyfill script executes.
 * We place it in <head> so the polyfill finds it when the document is
 * interactive. After Paged.js finishes rendering, `config.after` fires with the
 * flow object whose `.pages` array length is the definitive page count. We post
 * that count to the parent window so DocumentPreview can surface it.
 *
 * A fallback MutationObserver catches edge cases where PagedConfig.after does
 * not fire (e.g., zero-content documents that skip pagination).
 */
export function buildPreviewDocument(fragment: string): string {
  const fontImports = usedFontImports(fragment);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  ${fontImports ? fontImports + "\n  " : ""}@page { size: 8.5in 11in; margin: 0.7in 0.78in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #f8f7f6; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #1a1a1a;
  }
  ${DOCUMENT_TYPOGRAPHY_CSS}
  .pagedjs_page {
    background: #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08), 0 6px 24px rgba(0,0,0,0.07);
    margin: 0 auto 24px;
  }
</style>
<script>
  // Must be defined before paged.polyfill.js loads.
  window.PagedConfig = {
    after: function(flow) {
      var count = flow && flow.pages ? flow.pages.length : document.querySelectorAll('.pagedjs_page').length;
      parent.postMessage({ type: 'pagedjs-pages', count: count }, '*');
    }
  };
</script>
<script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>
</head>
<body>
${fragment}
</body>
</html>`;
}
