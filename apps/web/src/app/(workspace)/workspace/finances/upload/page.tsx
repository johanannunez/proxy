import type { Metadata } from "next";
import { UploadForm } from "./UploadForm";

export const metadata: Metadata = { title: "Upload Receipt" };

export default function UploadReceiptPage() {
  return <UploadForm />;
}
