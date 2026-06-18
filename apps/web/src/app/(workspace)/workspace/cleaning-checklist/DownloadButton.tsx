import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";

/**
 * Download the pre-generated cleaning checklist PDF. The file lives
 * in `apps/web/public/cleaning-checklist.pdf` and is built by
 * `scripts/build-checklist-pdf.tsx` from the shared modules data. The
 * `download` attribute forces the browser to download instead of
 * opening the PDF inline, which matches premium product expectations
 * (a real file in the Downloads folder, not a new tab the user has to
 * "save as" from).
 */
export function DownloadButton() {
  return (
    <a
      href="/cleaning-checklist.pdf"
      download="proxy-cleaning-checklist.pdf"
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
      style={{
        backgroundColor: "var(--color-brand)",
      }}
    >
      <DownloadSimple size={14} weight="bold" />
      Download PDF
    </a>
  );
}
