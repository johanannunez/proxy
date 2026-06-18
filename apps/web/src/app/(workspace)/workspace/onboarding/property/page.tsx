import { redirect } from "next/navigation";

// The legacy /portal/onboarding/property wizard is superseded by the
// new /portal/setup/basics flow. Hard-redirect so stale bookmarks and
// old dashboard links land on the current UI.
export default function AddPropertyPage() {
  redirect("/workspace/setup");
}
