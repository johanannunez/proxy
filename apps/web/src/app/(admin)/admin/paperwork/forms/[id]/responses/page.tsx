import { notFound } from "next/navigation";
import {
  getForm,
  listFormResponsesDetailed,
  getFormViewCount,
} from "@/lib/admin/forms";
import { ResponsesHub } from "./ResponsesHub";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FormResponsesPage({ params }: Props) {
  const { id } = await params;
  const [form, responses, viewCount] = await Promise.all([
    getForm(id),
    listFormResponsesDetailed(id),
    getFormViewCount(id),
  ]);
  if (!form) notFound();
  return <ResponsesHub form={form} responses={responses} viewCount={viewCount} />;
}
