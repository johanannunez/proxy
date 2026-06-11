"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { upsertPropertyForm } from "@/lib/workspace/property-forms";

const BUCKET = "property-documents";

const schema = z.object({
  property_id: z.string().uuid("Property ID is required."),
  is_permit_required: z.string().trim().max(500).optional().default(""),
  permit_number: z.string().trim().max(500).optional().default(""),
  issuing_authority: z.string().trim().max(500).optional().default(""),
  issue_date: z.string().trim().max(500).optional().default(""),
  expiration_date: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  existing_permit_pdf_url: z.string().optional().default(""),
});

export type SaveStrPermitState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveStrPermit(
  _prev: SaveStrPermitState,
  formData: FormData,
): Promise<SaveStrPermitState> {
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string"),
  );
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "A few fields need your attention.", fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const v = parsed.data;
  const svc = createServiceClient();

  // Handle file upload
  let permitPdfUrl = v.existing_permit_pdf_url;
  const file = formData.get("permit_pdf") as File | null;
  if (file && file.size > 0) {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return { error: "Only PDF, JPG, and PNG files are allowed." };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { error: "File must be under 10 MB." };
    }
    const ext = file.name.split(".").pop() ?? "pdf";
    const safeName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 60);
    const entropy = randomBytes(4).toString("hex");
    const path = `${v.property_id}/str_permit/${Date.now()}-${entropy}-${safeName}.${ext}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadErr } = await svc.storage
      .from(BUCKET)
      .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: false });
    if (uploadErr) return { error: "Document upload failed. Please try again." };
    const { data: urlData } = svc.storage.from(BUCKET).getPublicUrl(path);
    permitPdfUrl = urlData.publicUrl;
  }

  const saveError = await upsertPropertyForm(v.property_id, "str_permit", {
          is_permit_required: v.is_permit_required,
          permit_number: v.permit_number,
          issuing_authority: v.issuing_authority,
          issue_date: v.issue_date,
          expiration_date: v.expiration_date,
          notes: v.notes,
          permit_pdf_url: permitPdfUrl,
        });

  if (saveError) return { error: saveError };

  untypedDatabase(svc)
    .from("activity_log")
    .insert({
      action: "property_updated",
      entity_type: "property",
      entity_id: v.property_id,
      actor_id: user.id,
      metadata: { field_name: "str_permit", description: "STR permit saved" },
    })
    .then(() => {}, () => {});

  revalidatePath("/workspace/setup");
  redirect(`/workspace/setup/hoa-info?property=${v.property_id}`);
}
