import type { Metadata } from "next";
import { listAllFormResponses } from "@/lib/admin/forms";
import { ResponsesHub } from "./ResponsesHub";

export const metadata: Metadata = { title: "Form Responses" };
export const dynamic = "force-dynamic";

export default async function ResponsesPage() {
  const responses = await listAllFormResponses();
  return <ResponsesHub responses={responses} />;
}
