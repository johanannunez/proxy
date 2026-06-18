// apps/web/src/lib/admin/vendors-list.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { untypedDatabase } from '@/lib/supabase/untyped';

type VendorDbRow = {
  id: string;
  full_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  trade: string | null;
  notes: string | null;
  created_at: string;
};

export type VendorRow = {
  id: string;
  fullName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  trade: string | null;
  notes: string | null;
  createdAt: string;
};

export async function fetchVendors(): Promise<VendorRow[]> {
  const supabase = await createClient();
  // vendors not yet in generated types; use the untyped helper.
  const { data, error } = await untypedDatabase(supabase)
    .from<VendorDbRow[]>('vendors')
    .select('id, full_name, company_name, phone, email, trade, notes, created_at')
    .order('full_name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    companyName: r.company_name ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    trade: r.trade ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
  }));
}
