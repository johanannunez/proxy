import { notFound } from "next/navigation";
import { getFormBySlug } from "@/lib/admin/forms";
import { FormFillPage } from "./FormFillPage";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PublicFormPage({ params }: Props) {
  const { slug } = await params;
  const form = await getFormBySlug(slug);

  if (!form || !form.is_active || !form.is_public) {
    notFound();
  }

  return <FormFillPage form={form} />;
}
