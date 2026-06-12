import { redirect } from "next/navigation";

/**
 * Forms stopped being a nav concept in the 2026-06-12 paperwork unification:
 * form templates live in the unified Templates tab. Old links keep working.
 */
export default function FormsRedirect() {
  redirect("/admin/paperwork/templates?type=form");
}
