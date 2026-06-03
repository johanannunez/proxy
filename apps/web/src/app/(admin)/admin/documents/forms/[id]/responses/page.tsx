import { notFound } from "next/navigation";
import { getForm, listFormResponses } from "@/lib/admin/forms";
import { FormResponsesHub } from "./FormResponsesHub";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FormResponsesPage({ params }: Props) {
  const { id } = await params;
  const form = await getForm(id);
  if (!form) notFound();

  const responses = await listFormResponses(id);

  return <FormResponsesHub form={form} responses={responses} />;
}
