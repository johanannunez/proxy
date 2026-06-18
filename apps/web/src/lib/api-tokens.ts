// Edge-compatible. Uses Web Crypto API only -- no Node.js deps.

import { untypedDatabase } from '@/lib/supabase/untyped';

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Minimal structural interface to avoid importing server-only Supabase client types
// into this edge-compatible module.
interface MinimalSupabaseClient {
  from(table: string): {
    select(cols: string): unknown;
    update(values: Record<string, unknown>): unknown;
  };
}

export async function verifyApiToken(
  providedToken: string,
  supabaseClient: MinimalSupabaseClient,
): Promise<{ profileId: string; tokenId: string } | null> {
  const hash = await hashToken(providedToken);
  const db = untypedDatabase(supabaseClient);
  const { data } = await db
    .from<{ id: string; profile_id: string }>('api_tokens')
    .select('id, profile_id')
    .eq('token_hash', hash)
    .single();
  if (!data) return null;

  // Fire-and-forget last_used_at update -- non-critical, background
  void db
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return { profileId: data.profile_id, tokenId: data.id };
}
