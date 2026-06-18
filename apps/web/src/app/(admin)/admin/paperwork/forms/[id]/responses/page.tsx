import { redirect } from "next/navigation";

/** A form's responses live with the form: template detail, Responses tab. */
export default async function FormResponsesRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/paperwork/templates/${id}?tab=responses`);
}
