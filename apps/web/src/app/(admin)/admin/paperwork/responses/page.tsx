import { redirect } from "next/navigation";

/**
 * The global Responses roll-up was deleted in the 2026-06-12 paperwork
 * unification (per-form-only decision): each form's responses live on its
 * template detail page. Recent submissions still surface in the Today cockpit
 * and the Needs Action queue.
 */
export default function ResponsesRedirect() {
  redirect("/admin/paperwork/templates?type=form");
}
