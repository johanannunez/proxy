import "server-only";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";

export type FinancesDashboardSchedule = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  name: string;
  status: string;
  nextInvoiceDate: string | null;
  lineCount: number;
};

export type FinancesDashboard = {
  financeProfileCount: number;
  activeScheduleCount: number;
  openInvoiceCount: number;
  failedPaymentCount: number;
  totalOpenCents: number;
  paymentMethodCount: number;
  schedules: FinancesDashboardSchedule[];
};

type Countable = { id: string };

type InvoiceTotalRow = {
  total_cents: number;
};

type ScheduleRow = {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
  next_invoice_date: string | null;
};

type ScheduleLineRow = {
  schedule_id: string;
};

type WorkspaceRow = {
  id: string;
  name: string;
};

async function countRows(table: string, column: string, value: string): Promise<number> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);
  const { data } = await db
    .from<Countable[]>(table)
    .select("id")
    .eq(column, value);
  return data?.length ?? 0;
}

export async function fetchFinancesDashboard(): Promise<FinancesDashboard> {
  const supabase = await createClient();
  const db = untypedDatabase(supabase);

  const [
    { data: profiles },
    activeScheduleCount,
    openInvoiceCount,
    failedPaymentCount,
    { data: openInvoices },
    { data: paymentMethods },
    { data: schedules },
  ] = await Promise.all([
    db.from<Countable[]>("billing_profiles").select("id").eq("active", true),
    countRows("billing_schedules", "status", "active"),
    countRows("billing_invoices", "status", "open"),
    countRows("billing_invoices", "status", "payment_failed"),
    db
      .from<InvoiceTotalRow[]>("billing_invoices")
      .select("total_cents")
      .in("status", ["approved", "open", "payment_failed"]),
    db
      .from<Countable[]>("billing_payment_methods")
      .select("id")
      .eq("status", "active"),
    db
      .from<ScheduleRow[]>("billing_schedules")
      .select("id, workspace_id, name, status, next_invoice_date")
      .in("status", ["draft", "active", "paused"])
      .order("next_invoice_date", { ascending: true })
      .limit(6),
  ]);

  const scheduleWorkspaceIds = Array.from(new Set((schedules ?? []).map((s) => s.workspace_id)));
  const scheduleIds = (schedules ?? []).map((s) => s.id);
  const [{ data: workspaces }, { data: scheduleLines }] = await Promise.all([
    scheduleWorkspaceIds.length > 0
      ? db.from<WorkspaceRow[]>("workspaces").select("id, name").in("id", scheduleWorkspaceIds)
      : Promise.resolve({ data: [] as WorkspaceRow[] }),
    scheduleIds.length > 0
      ? db.from<ScheduleLineRow[]>("billing_schedule_lines").select("schedule_id").in("schedule_id", scheduleIds)
      : Promise.resolve({ data: [] as ScheduleLineRow[] }),
  ]);

  const workspaceNameById = new Map((workspaces ?? []).map((workspace) => [workspace.id, workspace.name]));
  const lineCountBySchedule = new Map<string, number>();
  for (const line of scheduleLines ?? []) {
    lineCountBySchedule.set(line.schedule_id, (lineCountBySchedule.get(line.schedule_id) ?? 0) + 1);
  }

  return {
    financeProfileCount: profiles?.length ?? 0,
    activeScheduleCount,
    openInvoiceCount,
    failedPaymentCount,
    totalOpenCents: (openInvoices ?? []).reduce(
      (sum, invoice) => sum + invoice.total_cents,
      0,
    ),
    paymentMethodCount: paymentMethods?.length ?? 0,
    schedules: (schedules ?? []).map((schedule) => ({
      id: schedule.id,
      workspaceId: schedule.workspace_id,
      workspaceName: workspaceNameById.get(schedule.workspace_id) ?? "Unknown Workspace",
      name: schedule.name,
      status: schedule.status,
      nextInvoiceDate: schedule.next_invoice_date,
      lineCount: lineCountBySchedule.get(schedule.id) ?? 0,
    })),
  };
}
