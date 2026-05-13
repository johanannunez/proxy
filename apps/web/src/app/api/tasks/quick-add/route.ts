import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as chrono from 'chrono-node';
import { verifyApiToken } from '@/lib/api-tokens';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const result = await verifyApiToken(token, supabase as any);
  if (!result) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title, dueDate } = body as { title?: string; dueDate?: string };
  const trimmedTitle = title?.trim();
  if (!trimmedTitle) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (trimmedTitle.length > 500) {
    return NextResponse.json({ error: 'title must be 500 characters or fewer' }, { status: 400 });
  }

  // Accept ISO date string or natural language ("next monday", "tomorrow", etc.)
  let dueAt: string | null = null;
  if (dueDate?.trim()) {
    const parsed = chrono.parseDate(dueDate, new Date(), { forwardDate: true });
    if (parsed) {
      dueAt = parsed.toISOString();
    } else {
      const d = new Date(dueDate);
      if (!isNaN(d.getTime())) dueAt = d.toISOString();
    }
  }

  const caldavUid = `task-${crypto.randomUUID()}@parcelco.com`;

  const { data, error } = await (supabase as any)
    .from('tasks')
    .insert({
      title: trimmedTitle,
      created_by: result.profileId,
      due_at: dueAt,
      priority: 4,
      caldav_uid: caldavUid,
      status: 'todo',
    })
    .select('id, title')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.theparcelco.com';
  return NextResponse.json({
    id: data.id,
    title: data.title,
    url: `${appUrl}/admin/tasks`,
  });
}
