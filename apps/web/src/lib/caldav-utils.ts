// CalDAV PRIORITY uses 1-9 scale. 1=highest priority.
const PRIORITY_MAP: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 9 };

export interface CalDAVTask {
  id: string;
  caldavUid: string;
  title: string;
  dueAt: string | null;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority: 1 | 2 | 3 | 4;
  updatedAt: string;
}

export function taskToVTodo(task: CalDAVTask, baseUrl: string): string {
  const uid = task.caldavUid;
  const dtStamp = formatIcalDate(new Date());
  const lastMod = formatIcalDate(new Date(task.updatedAt));
  const icalStatus = task.status === 'done' ? 'COMPLETED' : 'NEEDS-ACTION';
  const priority = PRIORITY_MAP[task.priority] ?? 9;
  const taskUrl = `${baseUrl}/admin/tasks`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Proxy//TaskOS//EN',
    'BEGIN:VTODO',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `LAST-MODIFIED:${lastMod}`,
    `SUMMARY:${escapeIcal(task.title)}`,
    `STATUS:${icalStatus}`,
    `PRIORITY:${priority}`,
    `DESCRIPTION:${taskUrl}`,
  ];

  if (task.dueAt) {
    lines.push(`DUE:${formatIcalDate(new Date(task.dueAt))}`);
  }

  if (task.status === 'done') {
    lines.push(`COMPLETED:${lastMod}`);
  }

  lines.push('END:VTODO', 'END:VCALENDAR');
  // RFC 5545 requires CRLF line endings and a trailing CRLF after the last line
  return lines.join('\r\n') + '\r\n';
}

export function generateETag(updatedAt: string): string {
  return `"${new Date(updatedAt).getTime()}"`;
}

export function parseVTodoStatus(body: string): 'COMPLETED' | 'NEEDS-ACTION' | null {
  // Use [^\r\n]+ to correctly handle CRLF-terminated bodies from CalDAV clients
  const match = body.match(/^STATUS:([^\r\n]+)/m);
  if (!match) return null;
  const val = match[1].trim();
  if (val === 'COMPLETED' || val === 'NEEDS-ACTION') return val;
  return null;
}

export function parseVTodoUid(body: string): string | null {
  // Use [^\r\n]+ to correctly handle CRLF-terminated bodies from CalDAV clients
  const match = body.match(/^UID:([^\r\n]+)/m);
  return match?.[1]?.trim() ?? null;
}

// Produces UTC datetime in iCalendar format: YYYYMMDDTHHmmssZ (RFC 5545 section 3.3.5)
function formatIcalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

function escapeIcal(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
