import type { Metadata } from "next";
import {
  VideoCamera,
  CalendarCheck,
  Clock,
  ArrowRight,
  CheckCircle,
  Circle,
  Handshake,
  FileText,
  CaretDown,
  Sparkle,
  Lightning,
} from "@phosphor-icons/react/dist/ssr";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { EmptyState } from "@/components/workspace/EmptyState";
import { formatMedium } from "@/lib/format";
import { propertyLabel } from "@/lib/address";

export const metadata: Metadata = { title: "Meetings" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionItem = {
  id: string;
  text: string;
  completed: boolean;
};

type OwnerMeeting = {
  id: string;
  owner_id: string;
  title: string;
  scheduled_at: string | null;
  status: "scheduled" | "completed" | "cancelled";
  meet_link: string | null;
  duration_minutes: number | null;
  ai_summary: string | null;
  action_items: ActionItem[] | null;
  notes: string | null;
  visibility: string;
  property_id: string | null;
  created_at: string;
};

type MeetingNote = {
  id: string;
  body: string;
  visibility: string;
  property_id: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const meetingDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatMeetingDate(scheduledAt: string | null): string {
  if (!scheduledAt) return "Date TBD";
  const d = new Date(scheduledAt);
  return meetingDateFmt.format(d);
}

function formatMeetingTime(scheduledAt: string | null): string | null {
  if (!scheduledAt) return null;
  const d = new Date(scheduledAt);
  return timeFmt.format(d);
}

function calcDaysAway(scheduledAt: string | null): number | null {
  if (!scheduledAt) return null;
  const now = Date.now();
  const target = new Date(scheduledAt).getTime();
  const diff = Math.round((target - now) / 86_400_000);
  return diff < 0 ? null : diff;
}

function parseActionItems(raw: unknown): ActionItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ActionItem[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as ActionItem[];
    } catch {
      // not valid JSON
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Page (RSC)
// ---------------------------------------------------------------------------

export default async function MeetingsPage() {
  const { userId, client } = await getWorkspaceContext();

  const now = new Date();

  const [meetingsResult, notesResult, { data: properties }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)
      .from("owner_meetings")
      .select(
        "id, owner_id, title, scheduled_at, status, meet_link, duration_minutes, ai_summary, action_items, notes, visibility, property_id, created_at",
      )
      .eq("owner_id", userId)
      .eq("visibility", "shared")
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)
      .from("owner_notes")
      .select("id, body, visibility, property_id, created_at")
      .eq("owner_id", userId)
      .neq("visibility", "private")
      .order("created_at", { ascending: false }),
    client.from("properties").select("id, address_line1, address_line2").eq("owner_id", userId),
  ]);

  const allMeetings: OwnerMeeting[] = (meetingsResult.data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => ({
      ...m,
      action_items: parseActionItems(m.action_items),
    }),
  );

  const notes: MeetingNote[] = notesResult.data ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propertyMap = new Map((properties ?? []).map((p: any) => [p.id, propertyLabel(p)]));

  // Split meetings
  const upcomingMeetings = allMeetings.filter(
    (m) =>
      m.status === "scheduled" &&
      (m.scheduled_at === null || new Date(m.scheduled_at) >= now),
  );

  const pastMeetings = allMeetings.filter(
    (m) =>
      m.status === "completed" ||
      (m.scheduled_at !== null && new Date(m.scheduled_at) < now),
  );

  // The NEXT upcoming meeting goes in the banner
  const bannerMeeting = upcomingMeetings.length > 0 ? upcomingMeetings[0]! : null;
  // Remaining upcoming meetings (after the banner one)
  const remainingUpcoming = upcomingMeetings.slice(1);

  const isEmpty = allMeetings.length === 0 && notes.length === 0;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Banner                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(130deg, #1B77BE 0%, #02AAEB 60%, #38c8ff 100%)",
        }}
      >
        {/* Decorative circles */}
        <span
          className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -bottom-14 right-24 h-40 w-40 rounded-full"
          style={{ background: "rgba(255,255,255,0.06)" }}
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute left-1/2 top-0 h-24 w-24 -translate-x-1/2 rounded-full"
          style={{ background: "rgba(255,255,255,0.04)" }}
          aria-hidden="true"
        />

        <div className="relative z-10 px-7 py-6">
          {bannerMeeting ? (
            /* ── UPCOMING MEETING HERO STATE ── */
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                {/* Label row */}
                <div className="flex items-center gap-1.5">
                  <CalendarCheck
                    size={11}
                    weight="duotone"
                    style={{ color: "rgba(255,255,255,0.60)" }}
                  />
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                    style={{ color: "rgba(255,255,255,0.60)" }}
                  >
                    Next meeting
                  </p>
                </div>

                {/* Days away + title */}
                <div className="mt-2 flex items-end gap-2.5">
                  {calcDaysAway(bannerMeeting.scheduled_at) !== null && (
                    <>
                      <span
                        className="font-bold leading-none"
                        style={{
                          color: "#fff",
                          fontSize:
                            (calcDaysAway(bannerMeeting.scheduled_at) ?? 0) <= 1
                              ? "2.75rem"
                              : "3.25rem",
                          letterSpacing: "-0.03em",
                        }}
                      >
                        {calcDaysAway(bannerMeeting.scheduled_at) === 0
                          ? "Today"
                          : calcDaysAway(bannerMeeting.scheduled_at) === 1
                            ? "Tomorrow"
                            : calcDaysAway(bannerMeeting.scheduled_at)}
                      </span>
                      {(calcDaysAway(bannerMeeting.scheduled_at) ?? 0) > 1 && (
                        <span
                          className="mb-1.5 text-sm font-medium leading-tight"
                          style={{ color: "rgba(255,255,255,0.70)" }}
                        >
                          days away
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Meeting title + time */}
                <p
                  className="mt-1.5 text-[14px] font-semibold leading-snug"
                  style={{ color: "#fff" }}
                >
                  {bannerMeeting.title}
                </p>
                <p
                  className="mt-0.5 text-[12px]"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {formatMeetingDate(bannerMeeting.scheduled_at)}
                  {formatMeetingTime(bannerMeeting.scheduled_at) && (
                    <> &middot; {formatMeetingTime(bannerMeeting.scheduled_at)}</>
                  )}
                  {bannerMeeting.duration_minutes && (
                    <> &middot; {bannerMeeting.duration_minutes} min</>
                  )}
                </p>
              </div>

              {/* Join button — only when meet_link exists */}
              {bannerMeeting.meet_link && (
                <div className="shrink-0">
                  <a
                    href={bannerMeeting.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "#fff", color: "#1B77BE" }}
                  >
                    <VideoCamera size={15} weight="fill" />
                    Join meeting
                  </a>
                </div>
              )}
            </div>
          ) : (
            /* ── EMPTY BANNER STATE ── */
            <div>
              <div className="flex items-center gap-1.5">
                <CalendarCheck
                  size={11}
                  weight="duotone"
                  style={{ color: "rgba(255,255,255,0.60)" }}
                />
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                  style={{ color: "rgba(255,255,255,0.60)" }}
                >
                  Check-ins &amp; updates
                </p>
              </div>
              <h1
                className="mt-1.5 text-xl font-bold tracking-tight"
                style={{ color: "#fff" }}
              >
                Meetings &amp; Updates
              </h1>
              <p
                className="mt-1 text-[13px]"
                style={{ color: "rgba(255,255,255,0.78)" }}
              >
                Your next check-in with Proxy will appear here when scheduled.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* EMPTY STATE — no meetings and no notes                              */}
      {/* ------------------------------------------------------------------ */}
      {isEmpty && (
        <EmptyState
          icon={<Handshake size={26} weight="duotone" />}
          title="Nothing here yet"
          body="Meeting notes and Proxy updates will appear here once you have a check-in scheduled."
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Upcoming meetings section (remaining after banner)               */}
      {/* ------------------------------------------------------------------ */}
      {remainingUpcoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader icon={<Lightning size={14} weight="fill" style={{ color: "var(--color-brand)" }} />} label="Upcoming" />
          <div className="flex flex-col gap-3">
            {remainingUpcoming.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                propertyName={meeting.property_id ? (propertyMap.get(meeting.property_id) ?? null) : null}
              />
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. Past meetings section                                             */}
      {/* ------------------------------------------------------------------ */}
      {pastMeetings.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader icon={<CalendarCheck size={14} weight="fill" style={{ color: "var(--color-text-tertiary)" }} />} label="Past meetings" />
          <div className="flex flex-col gap-3">
            {pastMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                propertyName={meeting.property_id ? (propertyMap.get(meeting.property_id) ?? null) : null}
              />
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. Notes from Proxy                                                 */}
      {/* ------------------------------------------------------------------ */}
      {notes.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader
            icon={<FileText size={14} weight="fill" style={{ color: "var(--color-text-tertiary)" }} />}
            label="Notes from Proxy"
          />
          <div className="flex flex-col gap-3">
            {notes.map((note) => {
              const propLabel = note.property_id ? propertyMap.get(note.property_id) : null;
              return (
                <div
                  key={note.id}
                  className="rounded-2xl border p-5"
                  style={{
                    backgroundColor: "var(--color-white)",
                    borderColor: "var(--color-warm-gray-200)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: "rgba(2, 170, 235, 0.08)",
                          color: "var(--color-brand)",
                        }}
                      >
                        <FileText size={13} weight="duotone" />
                      </span>
                      {propLabel && (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: "rgba(2, 170, 235, 0.10)",
                            color: "var(--color-brand)",
                          }}
                        >
                          {propLabel}
                        </span>
                      )}
                    </div>
                    <span
                      className="shrink-0 text-xs"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {formatMedium(note.created_at)}
                    </span>
                  </div>
                  <p
                    className="mt-3 whitespace-pre-wrap text-sm leading-relaxed"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {note.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader (pure RSC — no interactivity needed)
// ---------------------------------------------------------------------------

function SectionHeader({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-2 border-b pb-2.5"
      style={{ borderColor: "var(--color-warm-gray-200)" }}
    >
      {icon}
      <span
        className="text-[13px] font-semibold"
        style={{ color: "var(--color-text-primary)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MeetingCard — uses <details>/<summary> for expand/collapse (no client state)
// ---------------------------------------------------------------------------

function MeetingCard({
  meeting,
  propertyName,
}: {
  meeting: OwnerMeeting;
  propertyName: string | null;
}) {
  const isUpcoming = meeting.status === "scheduled";
  const isCompleted = meeting.status === "completed";
  const actionItems = meeting.action_items ?? [];
  const completedCount = actionItems.filter((a) => a.completed).length;
  const daysAway = calcDaysAway(meeting.scheduled_at);
  const meetingDate = formatMeetingDate(meeting.scheduled_at);
  const meetingTime = formatMeetingTime(meeting.scheduled_at);

  const summaryPreview =
    meeting.ai_summary && meeting.ai_summary.length > 150
      ? meeting.ai_summary.slice(0, 150).trimEnd() + "..."
      : meeting.ai_summary;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      {/* Top row: icon + title + badges + join button */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: isUpcoming
              ? "rgba(2, 170, 235, 0.10)"
              : "var(--color-warm-gray-50)",
            color: isUpcoming ? "var(--color-brand)" : "var(--color-text-tertiary)",
          }}
        >
          <VideoCamera size={16} weight="duotone" />
        </span>

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-sm font-semibold leading-snug"
              style={{ color: "var(--color-text-primary)" }}
            >
              {meeting.title}
            </span>

            {/* Status badge */}
            {isUpcoming && daysAway !== null && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: "rgba(2, 170, 235, 0.10)",
                  color: "var(--color-brand)",
                }}
              >
                {daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `In ${daysAway}d`}
              </span>
            )}
            {isUpcoming && daysAway === null && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: "rgba(2, 170, 235, 0.10)",
                  color: "var(--color-brand)",
                }}
              >
                Scheduled
              </span>
            )}
            {isCompleted && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.10)",
                  color: "#059669",
                }}
              >
                Completed
              </span>
            )}
          </div>

          {/* Date + time + duration */}
          <div
            className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <span className="flex items-center gap-1">
              <CalendarCheck size={11} weight="duotone" />
              {meetingDate}
            </span>
            {meetingTime && (
              <>
                <span style={{ color: "var(--color-warm-gray-400)" }}>&middot;</span>
                <span className="flex items-center gap-1">
                  <Clock size={11} weight="duotone" />
                  {meetingTime}
                </span>
              </>
            )}
            {meeting.duration_minutes && (
              <>
                <span style={{ color: "var(--color-warm-gray-400)" }}>&middot;</span>
                <span>{meeting.duration_minutes} min</span>
              </>
            )}
          </div>

          {/* Property tag */}
          {propertyName && (
            <div className="mt-1.5">
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: "rgba(2, 170, 235, 0.08)",
                  color: "var(--color-brand)",
                }}
              >
                {propertyName}
              </span>
            </div>
          )}
        </div>

        {/* Join button for upcoming with meet_link */}
        {isUpcoming && meeting.meet_link && (
          <a
            href={meeting.meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-80"
            style={{
              backgroundColor: "var(--color-brand)",
              color: "#fff",
            }}
          >
            <ArrowRight size={12} weight="bold" />
            Join
          </a>
        )}
      </div>

      {/* AI Summary — collapsible via <details> */}
      {meeting.ai_summary && (
        <div
          className="mt-3 border-t pt-3"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <details className="group">
            <summary
              className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-semibold select-none"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <Sparkle size={12} weight="duotone" style={{ color: "var(--color-brand)" }} />
              AI summary
              <CaretDown
                size={11}
                weight="bold"
                style={{ color: "var(--color-text-tertiary)" }}
                className="ml-auto transition-transform group-open:rotate-180"
              />
            </summary>

            {/* Collapsed preview — hidden when open */}
            <p
              className="mt-2 block text-[12px] leading-relaxed group-open:hidden"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {summaryPreview}
            </p>

            {/* Full summary — visible when open */}
            <p
              className="mt-2 hidden text-[12px] leading-relaxed group-open:block"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {meeting.ai_summary}
            </p>
          </details>
        </div>
      )}

      {/* Action items */}
      {actionItems.length > 0 && (
        <div
          className="mt-3 border-t pt-3"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Action items
            </span>
            {actionItems.length > 1 && (
              <span
                className="text-[11px]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {completedCount}/{actionItems.length}
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-1.5">
            {actionItems.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span
                  className="mt-0.5 shrink-0"
                  style={{
                    color: item.completed ? "#059669" : "var(--color-warm-gray-400)",
                  }}
                >
                  {item.completed ? (
                    <CheckCircle size={14} weight="fill" />
                  ) : (
                    <Circle size={14} weight="regular" />
                  )}
                </span>
                <span
                  className="text-[12px] leading-relaxed"
                  style={{
                    color: item.completed
                      ? "var(--color-text-tertiary)"
                      : "var(--color-text-primary)",
                    textDecoration: item.completed ? "line-through" : "none",
                  }}
                >
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
