import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Paperwork" };
export const dynamic = "force-dynamic";

/**
 * The standalone Templates list was retired in the 2026-06-14 redesign.
 * Signature masters now live in the Signatures tab's library; form masters live
 * on the Forms tab. The templates/[id] master-detail route stays as shared
 * infrastructure. This route only forwards old links to their new home and
 * preserves the deep-link query the shell understands.
 */
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // Form masters moved to the Forms tab.
  if (params.type === "form") {
    redirect("/admin/paperwork/forms");
  }

  // "Upload a PDF" deep link: keep the query so the shell opens the modal.
  if (params.create === "pdf") {
    redirect("/admin/paperwork/signatures?create=pdf");
  }

  redirect("/admin/paperwork/signatures");
}
