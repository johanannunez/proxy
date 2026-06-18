import { redirect } from "next/navigation";

/** The form builder now lives on the template detail page (Build tab). */
export default async function FormEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/paperwork/templates/${id}`);
}
