"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { upsertPropertyForm } from "@/lib/workspace/property-forms";

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

const inspectionSchema = z.object({
  property_id: z.string().uuid(),
  overall_condition: z.string().trim().max(100).optional().default(""),
  inspection_date: z.string().trim().max(100).optional().default(""),
  inspector_name: z.string().trim().max(200).optional().default(""),
  rooms: z.string().trim().max(5000).optional().default(""),
  appliance_inventory: z.string().trim().max(5000).optional().default(""),
  pre_existing_damage: z.string().trim().max(5000).optional().default(""),
  notes: z.string().trim().max(5000).optional().default(""),
});

export type SaveInspectionState = { error?: string; success?: boolean };

export async function saveInspection(
  _prev: SaveInspectionState,
  formData: FormData,
): Promise<SaveInspectionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = inspectionSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid form data." };

  const v = parsed.data;

  // Writes to the documents spine; verifies the caller is the property owner
  // or an admin before saving.
  const saveError = await upsertPropertyForm(v.property_id, "onboarding_inspection", {
    overall_condition: v.overall_condition,
    inspection_date: v.inspection_date,
    inspector_name: v.inspector_name,
    rooms: v.rooms,
    appliance_inventory: v.appliance_inventory,
    pre_existing_damage: v.pre_existing_damage,
    notes: v.notes,
  });

  if (saveError) return { error: saveError };

  revalidatePath(`/admin/properties/${v.property_id}/forms`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Offboarding
// ---------------------------------------------------------------------------

const offboardingSchema = z.object({
  property_id: z.string().uuid(),
  termination_notice_date: z.string().trim().max(100).optional().default(""),
  end_date: z.string().trim().max(100).optional().default(""),
  calendar_block_date: z.string().trim().max(100).optional().default(""),
  active_reservations_at_notice: z
    .string()
    .trim()
    .max(100)
    .optional()
    .default(""),
  final_payout_estimate: z.string().trim().max(100).optional().default(""),
  platform_transfer_notes: z.string().trim().max(5000).optional().default(""),
  key_lockbox_returned: z.string().trim().max(100).optional().default(""),
  final_statement_sent: z.string().trim().max(100).optional().default(""),
  owner_acknowledged_protocol: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default(""),
  notes: z.string().trim().max(5000).optional().default(""),
});

export type SaveOffboardingState = { error?: string; success?: boolean };

export async function saveOffboarding(
  _prev: SaveOffboardingState,
  formData: FormData,
): Promise<SaveOffboardingState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = offboardingSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid form data." };

  const v = parsed.data;

  // Writes to the documents spine; verifies the caller is the property owner
  // or an admin before saving.
  const saveError = await upsertPropertyForm(v.property_id, "property_offboarding", {
    termination_notice_date: v.termination_notice_date,
    end_date: v.end_date,
    calendar_block_date: v.calendar_block_date,
    active_reservations_at_notice: v.active_reservations_at_notice,
    final_payout_estimate: v.final_payout_estimate,
    platform_transfer_notes: v.platform_transfer_notes,
    key_lockbox_returned: v.key_lockbox_returned,
    final_statement_sent: v.final_statement_sent,
    owner_acknowledged_protocol: v.owner_acknowledged_protocol,
    notes: v.notes,
  });

  if (saveError) return { error: saveError };

  revalidatePath(`/admin/properties/${v.property_id}/forms`);
  return { success: true };
}
