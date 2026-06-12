import { headers } from "next/headers";
import { listDocumentTemplates } from "@/lib/admin/document-templates";
import { PROXY_ORG_ID } from "@/types/organizations";
import { PaperworkShell } from "../PaperworkShell";
import { TemplatesHub } from "./TemplatesHub";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;

  const all = await listDocumentTemplates();
  const systemTemplates = all.filter((t) => t.is_system);
  const customTemplates = all.filter((t) => !t.is_system);

  return (
    <PaperworkShell active="templates" orgId={orgId}>
      <main className={styles.main}>
        <TemplatesHub systemTemplates={systemTemplates} customTemplates={customTemplates} />
      </main>
    </PaperworkShell>
  );
}
