import { listForms } from "@/lib/admin/forms";
import { FormsHub } from "./FormsHub";

export const dynamic = "force-dynamic";

const PROXY_ORG_ID = process.env.PROXY_ORG_ID ?? "00000000-0000-0000-0000-000000000001";

export default async function FormsPage() {
  const forms = await listForms(PROXY_ORG_ID);

  return <FormsHub forms={forms} orgId={PROXY_ORG_ID} />;
}
