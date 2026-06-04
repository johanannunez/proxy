import {
  listForms,
  listRespondentProfiles,
  listPropertyOptionsForForms,
  type FormWithCount,
  type RespondentProfile,
  type FormPropertyOption,
} from "@/lib/admin/forms";
import { FormsHub } from "./FormsHub";

export const dynamic = "force-dynamic";

const PROXY_ORG_ID = process.env.PROXY_ORG_ID ?? "00000000-0000-0000-0000-000000000001";

export default async function FormsPage() {
  const [forms, respondents, propertyOptions] = await Promise.all([
    listForms(PROXY_ORG_ID),
    listRespondentProfiles(PROXY_ORG_ID),
    listPropertyOptionsForForms(PROXY_ORG_ID),
  ]) as [FormWithCount[], RespondentProfile[], FormPropertyOption[]];

  return (
    <FormsHub
      forms={forms}
      orgId={PROXY_ORG_ID}
      respondents={respondents}
      propertyOptions={propertyOptions}
    />
  );
}
