import { headers } from "next/headers";
import {
  listForms,
  listRespondentProfiles,
  listPropertyOptionsForForms,
  type FormWithCount,
  type RespondentProfile,
  type FormPropertyOption,
} from "@/lib/admin/forms";
import { PROXY_ORG_ID } from "@/types/organizations";
import { FormsHub } from "./FormsHub";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const headerList = await headers();
  const orgId = headerList.get("x-org-id") ?? PROXY_ORG_ID;

  const [forms, respondents, propertyOptions] = await Promise.all([
    listForms(orgId),
    listRespondentProfiles(orgId),
    listPropertyOptionsForForms(orgId),
  ]) as [FormWithCount[], RespondentProfile[], FormPropertyOption[]];

  return (
    <FormsHub
      forms={forms}
      orgId={orgId}
      respondents={respondents}
      propertyOptions={propertyOptions}
    />
  );
}
