import { notFound } from "next/navigation";
import { getForm } from "@/lib/admin/forms";
import { FormBuilderCanvas } from "./FormBuilderCanvas";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FormBuilderPage({ params }: Props) {
  const { id } = await params;
  const form = await getForm(id);
  if (!form) notFound();

  return <FormBuilderCanvas form={form} />;
}
