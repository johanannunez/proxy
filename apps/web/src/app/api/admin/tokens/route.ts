import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { untypedDatabase } from '@/lib/supabase/untyped';
import { generateToken, hashToken } from '@/lib/api-tokens';

type ProfileRow = { id: string };
type ApiTokenRow = { id: string; name: string; created_at: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json() as { name: string };
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const token = generateToken();
  const hash = await hashToken(token);

  const db = untypedDatabase(supabase);
  const { data: profile } = await db
    .from<ProfileRow>('profiles').select('id').eq('user_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { data, error } = await db
    .from<ApiTokenRow>('api_tokens')
    .insert({ profile_id: profile.id, name: name.trim(), token_hash: hash })
    .select('id, name, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return plaintext token ONCE. It is never stored or retrievable again.
  return NextResponse.json({ ...data, token });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = untypedDatabase(supabase);
  const { data: profile } = await db
    .from<ProfileRow>('profiles').select('id').eq('user_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { data } = await db
    .from<Array<ApiTokenRow & { last_used_at: string | null }>>('api_tokens')
    .select('id, name, last_used_at, created_at')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Ensure the token belongs to this user's profile before deleting
  const db = untypedDatabase(supabase);
  const { data: profile } = await db
    .from<ProfileRow>('profiles').select('id').eq('user_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { error: deleteError } = await db
    .from('api_tokens')
    .delete()
    .eq('id', id)
    .eq('profile_id', profile.id); // security: only delete tokens owned by this profile
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
