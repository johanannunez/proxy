"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createOneTimeInvoice, isStripeConfigured } from "@/lib/stripe";

const Input = z.object({
  ownerId: z.string().uuid(),
  propertyId: z.string().uuid().nullable().optional(),
  kind: z.enum(["onboarding_fee", "tech_fee", "adhoc"]).default("adhoc"),
  description: z.string().min(1).max(500).optional(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1).max(280),
        amount_cents: z.number().int().positive(),
        quantity: z.number().int().positive().optional(),
      }),
    )
    .min(1),
  dueInDays: z.number().int().positive().max(365).optional(),
});

type Result =
  | { ok: true; invoiceId: string; hostedInvoiceUrl: string | null }
  | { ok: false; error: string };

export async function createInvoiceForOwnerAction(
  raw: unknown,
): Promise<Result> {
  if (!isStripeConfigured()) {
    return {
      ok: false,
      error: "Stripe is not configured. Set STRIPE_SECRET_KEY.",
    };
  }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { ok: false, error: "Admins only" };

  try {
    const result = await createOneTimeInvoice({
      ...parsed.data,
      createdBy: user.id,
    });
    revalidatePath("/admin/finances");
    revalidatePath("/admin/workspaces");
    return {
      ok: true,
      invoiceId: result.invoiceId,
      hostedInvoiceUrl: result.hostedInvoiceUrl,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
