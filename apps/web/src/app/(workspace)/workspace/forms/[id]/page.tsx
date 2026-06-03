import { notFound } from "next/navigation";
import { getForm } from "@/lib/admin/forms";
import { createClient } from "@/lib/supabase/server";
import { FormFillPage } from "@/app/f/[slug]/FormFillPage";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WorkspaceFormPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const form = await getForm(id);
  if (!form || !form.is_active) notFound();

  return <FormFillPage form={form} />;
}
