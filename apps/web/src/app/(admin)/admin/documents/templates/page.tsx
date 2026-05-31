import { listDocumentTemplates } from "@/lib/admin/document-templates";
import { TemplatesHub } from "./TemplatesHub";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const all = await listDocumentTemplates();
  const systemTemplates = all.filter((t) => t.is_system);
  const customTemplates = all.filter((t) => !t.is_system);

  return (
    <main className={styles.main}>
      <TemplatesHub systemTemplates={systemTemplates} customTemplates={customTemplates} />
    </main>
  );
}
