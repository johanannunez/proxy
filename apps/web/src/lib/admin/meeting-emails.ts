/**
 * Premium HTML email templates for meeting lifecycle events.
 * Rendered inline (no React Email dependency) for maximum compatibility
 * with Gmail, Apple Mail, and Outlook.
 */

const LOGO_URL = "https://www.myproxyhost.com/brand/logo-full-color.png";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEETING_TYPE_LABEL: Record<string, string> = {
  phone_call: "Phone Call",
  video_call: "Video Call",
  in_person: "In Person",
};

const MEETING_TYPE_HUE: Record<string, { bg: string; color: string }> = {
  phone_call: { bg: "#16A34A18", color: "#16A34A" },
  video_call: { bg: "#1B77BE18", color: "#1B77BE" },
  in_person:  { bg: "#D9770618", color: "#D97706" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hour${h > 1 ? "s" : ""}`;
}

// Preheader spacer trick — prevents email clients from pulling body copy
function preheaderPadding(): string {
  return "&nbsp;".repeat(120);
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function shell(opts: {
  preheader: string;
  accentColor: string;
  statusLabel: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${opts.statusLabel}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F5F2EE;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#F5F2EE;">
    ${opts.preheader}${preheaderPadding()}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F2EE;">
    <tr><td align="center" style="padding:40px 16px 48px;">

      <!-- Card -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">

        <!-- Accent bar + logo header -->
        <tr><td style="background-color:${opts.accentColor};border-radius:14px 14px 0 0;padding:0;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:24px 36px 20px;">
                <img src="${LOGO_URL}" alt="Proxy" width="110" height="auto"
                     style="display:block;border:0;outline:none;line-height:100%;max-width:110px;
                            filter:brightness(0) invert(1);opacity:0.92;">
              </td>
              <td align="right" style="padding:24px 36px 20px;">
                <span style="display:inline-block;padding:5px 13px;border-radius:20px;
                             border:1.5px solid rgba(255,255,255,0.4);
                             color:rgba(255,255,255,0.95);
                             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                             font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                  ${opts.statusLabel}
                </span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- White body -->
        <tr><td style="background-color:#ffffff;padding:40px 36px 36px;">
          ${opts.body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background-color:#F5F2EE;border-radius:0 0 14px 14px;
                        padding:22px 36px 28px;border-top:1px solid #E8E3DC;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr><td>
              <p style="margin:0 0 5px;
                         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                         font-size:12px;color:#9A9590;line-height:1.5;">
                <strong style="color:#6A6560;font-weight:600;">Proxy</strong>
                &nbsp;&middot;&nbsp;Professional Property Management
              </p>
              <p style="margin:0;
                         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                         font-size:12px;color:#B0ABA6;line-height:1.5;">
                Questions? Reply to this email or reach us at
                <a href="mailto:jo@myproxyhost.com"
                   style="color:#1B77BE;text-decoration:none;">jo@myproxyhost.com</a>
              </p>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function typeBadge(meetingType: string): string {
  const label = MEETING_TYPE_LABEL[meetingType] ?? "Meeting";
  const hue = MEETING_TYPE_HUE[meetingType] ?? { bg: "#1B77BE18", color: "#1B77BE" };
  return `<div style="margin-bottom:10px;">
    <span style="display:inline-block;padding:4px 13px;border-radius:20px;
                 background-color:${hue.bg};color:${hue.color};
                 font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                 font-size:10px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;">
      ${label}
    </span>
  </div>`;
}

function meetingTitle(title: string): string {
  return `<h1 style="margin:0 0 28px;
                     font-family:Georgia,'Times New Roman',Times,serif;
                     font-size:28px;line-height:1.25;color:#1C1A17;
                     font-weight:normal;letter-spacing:-0.02em;">
    ${title}
  </h1>`;
}

function detailGrid(rows: Array<{ label: string; value: string }>): string {
  const rowsHtml = rows.map((r, i) => {
    const isLast = i === rows.length - 1;
    return `<tr>
      <td style="padding:11px 0${isLast ? "" : ";border-bottom:1px solid #F0EBE4"};
                  vertical-align:top;width:110px;">
        <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                     font-size:10px;font-weight:700;letter-spacing:0.07em;
                     text-transform:uppercase;color:#ACA9A4;">
          ${r.label}
        </span>
      </td>
      <td style="padding:11px 0${isLast ? "" : ";border-bottom:1px solid #F0EBE4"};vertical-align:top;">
        <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                     font-size:15px;color:#1C1A17;line-height:1.4;">
          ${r.value}
        </span>
      </td>
    </tr>`;
  }).join("");

  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
               style="border:1px solid #EDE8E2;border-radius:10px;margin-bottom:28px;">
    <tr><td style="padding:0 20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        ${rowsHtml}
      </table>
    </td></tr>
  </table>`;
}

function joinButton(href: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr><td style="border-radius:10px;background-color:#1B77BE;">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:13px 28px;border-radius:10px;
                background-color:#1B77BE;color:#ffffff;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                font-size:14px;font-weight:600;text-decoration:none;letter-spacing:-0.01em;
                mso-padding-alt:13px 28px;">
        Join Video Call &rarr;
      </a>
    </td></tr>
  </table>`;
}

function notesBlock(notes: string, accentColor: string): string {
  return `<div style="background-color:#F8F5F1;border-radius:10px;
                      border-left:3px solid ${accentColor};padding:18px 20px;">
    <p style="margin:0 0 8px;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
               font-size:10px;font-weight:700;letter-spacing:0.07em;
               text-transform:uppercase;color:#ACA9A4;">
      Notes
    </p>
    <p style="margin:0;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
               font-size:14px;color:#3A3835;line-height:1.65;">
      ${notes.replace(/\n/g, "<br>")}
    </p>
  </div>`;
}

function greeting(firstName: string): string {
  return `<p style="margin:0 0 18px;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                    font-size:16px;color:#5A5450;line-height:1.5;">
    Hi ${firstName},
  </p>`;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface MeetingCreatedData {
  ownerFirstName: string;
  title: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  meetingType: string;
  meetLink: string | null;
  propertyLabel: string | null;
  notes: string | null;
}

export function buildMeetingCreatedEmail(d: MeetingCreatedData): { subject: string; html: string } {
  const typeLabel = MEETING_TYPE_LABEL[d.meetingType] ?? "Meeting";
  const subject = `Your ${typeLabel.toLowerCase()} is confirmed: ${d.title}`;

  const gridRows: Array<{ label: string; value: string }> = [];
  if (d.scheduledAt) {
    gridRows.push({ label: "Date", value: fmtDate(d.scheduledAt) });
    gridRows.push({ label: "Time", value: fmtTime(d.scheduledAt) });
  }
  if (d.durationMinutes) {
    gridRows.push({ label: "Duration", value: fmtDuration(d.durationMinutes) });
  }
  if (d.propertyLabel) {
    gridRows.push({ label: "Property", value: d.propertyLabel });
  }
  if (d.meetLink) {
    gridRows.push({
      label: "Join link",
      value: `<a href="${d.meetLink}" style="color:#1B77BE;text-decoration:none;word-break:break-all;">${d.meetLink}</a>`,
    });
  }

  const body = [
    greeting(d.ownerFirstName),
    typeBadge(d.meetingType),
    meetingTitle(d.title),
    gridRows.length > 0 ? detailGrid(gridRows) : "",
    d.meetLink && d.meetingType === "video_call" ? joinButton(d.meetLink) : "",
    d.notes ? notesBlock(d.notes, "#1B77BE") : "",
  ].join("");

  return {
    subject,
    html: shell({
      preheader: `Your ${typeLabel.toLowerCase()} is confirmed${d.scheduledAt ? ` for ${fmtDate(d.scheduledAt)}` : ""}.`,
      accentColor: "#1B77BE",
      statusLabel: "Meeting Confirmed",
      body,
    }),
  };
}

// ---------------------------------------------------------------------------

export interface MeetingCancelledData {
  ownerFirstName: string;
  title: string;
  scheduledAt: string | null;
  meetingType: string;
}

export function buildMeetingCancelledEmail(d: MeetingCancelledData): { subject: string; html: string } {
  const typeLabel = MEETING_TYPE_LABEL[d.meetingType] ?? "Meeting";
  const subject = `Meeting cancelled: ${d.title}`;

  const body = [
    greeting(d.ownerFirstName),
    typeBadge(d.meetingType),
    `<h1 style="margin:0 0 14px;
                font-family:Georgia,'Times New Roman',Times,serif;
                font-size:28px;line-height:1.25;color:#9A9590;
                font-weight:normal;letter-spacing:-0.02em;text-decoration:line-through;">
      ${d.title}
    </h1>`,
    `<p style="margin:0 0 28px;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
               font-size:15px;color:#5A5450;line-height:1.65;">
      This meeting has been cancelled. Please reply to this email if you have questions
      or would like to find a new time.
    </p>`,
    d.scheduledAt
      ? `<div style="background-color:#F8F5F1;border-radius:10px;
                     border-left:3px solid #E2DDD8;padding:16px 20px;">
           <p style="margin:0 0 6px;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                      font-size:10px;font-weight:700;letter-spacing:0.07em;
                      text-transform:uppercase;color:#ACA9A4;">
             Was scheduled for
           </p>
           <p style="margin:0;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                      font-size:14px;color:#9A9590;line-height:1.5;text-decoration:line-through;">
             ${fmtDate(d.scheduledAt)} &middot; ${fmtTime(d.scheduledAt)}
           </p>
         </div>`
      : "",
  ].join("");

  return {
    subject,
    html: shell({
      preheader: `Your ${typeLabel.toLowerCase()} "${d.title}" has been cancelled.`,
      accentColor: "#7A7875",
      statusLabel: "Meeting Cancelled",
      body,
    }),
  };
}

// ---------------------------------------------------------------------------

export interface MeetingRescheduledData {
  ownerFirstName: string;
  title: string;
  oldScheduledAt: string | null;
  newScheduledAt: string | null;
  durationMinutes: number | null;
  meetingType: string;
  meetLink: string | null;
}

export function buildMeetingRescheduledEmail(d: MeetingRescheduledData): { subject: string; html: string } {
  const subject = `Meeting rescheduled: ${d.title}`;

  const body = [
    greeting(d.ownerFirstName),
    typeBadge(d.meetingType),
    meetingTitle(d.title),
    // Side-by-side time change
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
            style="margin-bottom:28px;">
      <tr>
        <td style="width:50%;padding-right:6px;vertical-align:top;">
          <div style="background-color:#F8F5F1;border-radius:10px;
                       border-left:3px solid #E2DDD8;padding:16px 18px;">
            <p style="margin:0 0 6px;
                       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                       font-size:10px;font-weight:700;letter-spacing:0.07em;
                       text-transform:uppercase;color:#ACA9A4;">Previously</p>
            <p style="margin:0;
                       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                       font-size:13px;color:#9A9590;line-height:1.55;text-decoration:line-through;">
              ${d.oldScheduledAt ? `${fmtDate(d.oldScheduledAt)}<br>${fmtTime(d.oldScheduledAt)}` : "No date set"}
            </p>
          </div>
        </td>
        <td style="width:50%;padding-left:6px;vertical-align:top;">
          <div style="background-color:#EEF5FB;border-radius:10px;
                       border-left:3px solid #1B77BE;padding:16px 18px;">
            <p style="margin:0 0 6px;
                       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                       font-size:10px;font-weight:700;letter-spacing:0.07em;
                       text-transform:uppercase;color:#1B77BE;">New time</p>
            <p style="margin:0;
                       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                       font-size:13px;color:#1C1A17;font-weight:600;line-height:1.55;">
              ${d.newScheduledAt ? `${fmtDate(d.newScheduledAt)}<br>${fmtTime(d.newScheduledAt)}` : "TBD"}
            </p>
          </div>
        </td>
      </tr>
    </table>`,
    d.meetLink && d.meetingType === "video_call" ? joinButton(d.meetLink) : "",
  ].join("");

  return {
    subject,
    html: shell({
      preheader: `Your meeting "${d.title}" has been moved to a new time.`,
      accentColor: "#C97820",
      statusLabel: "Time Changed",
      body,
    }),
  };
}

// ---------------------------------------------------------------------------

export interface MeetingRecapData {
  ownerFirstName: string;
  title: string;
  scheduledAt: string | null;
  aiSummary: string;
  actionItems: Array<{ text: string; completed: boolean }>;
  personalNote?: string;
}

export function buildMeetingRecapEmail(d: MeetingRecapData): { subject: string; html: string } {
  const subject = `Meeting recap: ${d.title}`;

  const actionItemsHtml = d.actionItems.length > 0
    ? `<div style="margin-top:20px;">
         <p style="margin:0 0 10px;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                    font-size:10px;font-weight:700;letter-spacing:0.07em;
                    text-transform:uppercase;color:#ACA9A4;">Action Items</p>
         <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
           ${d.actionItems.map((item, i) => {
             const isLast = i === d.actionItems.length - 1;
             return `<tr><td style="padding:8px 0${isLast ? "" : ";border-bottom:1px solid #EDE8E2"};">
               <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                 <tr>
                   <td style="vertical-align:top;padding-right:10px;width:20px;">
                     <div style="width:15px;height:15px;border-radius:50%;
                                  border:1.5px solid ${item.completed ? "#16A34A" : "#D1CEC9"};
                                  background-color:${item.completed ? "#16A34A" : "transparent"};
                                  margin-top:2px;">
                     </div>
                   </td>
                   <td style="vertical-align:top;">
                     <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                                  font-size:14px;color:${item.completed ? "#ACA9A4" : "#1C1A17"};
                                  line-height:1.5;
                                  ${item.completed ? "text-decoration:line-through;" : ""}">
                       ${item.text}
                     </span>
                   </td>
                 </tr>
               </table>
             </td></tr>`;
           }).join("")}
         </table>
       </div>`
    : "";

  const noteBlock = d.personalNote
    ? `<p style="font-size:15px;line-height:1.6;color:#3D3B38;margin:0 0 16px;">${d.personalNote}</p>`
    : "";

  const body = [
    greeting(d.ownerFirstName),
    `<div style="margin-bottom:10px;">
       <span style="display:inline-block;padding:4px 13px;border-radius:20px;
                    background-color:#05966918;color:#059669;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                    font-size:10px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;">
         Recap Available
       </span>
     </div>`,
    meetingTitle(d.title),
    d.scheduledAt
      ? `<p style="margin:-20px 0 24px;
                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                   font-size:13px;color:#ACA9A4;">
           ${fmtDate(d.scheduledAt)}
         </p>`
      : "",
    noteBlock,
    `<div style="background-color:#F8F5F1;border-radius:10px;
                  border-left:3px solid #059669;padding:20px 22px;">
       <p style="margin:0 0 10px;
                  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                  font-size:10px;font-weight:700;letter-spacing:0.07em;
                  text-transform:uppercase;color:#ACA9A4;">Summary</p>
       <p style="margin:0;
                  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                  font-size:14px;color:#3A3835;line-height:1.7;">
         ${d.aiSummary}
       </p>
       ${actionItemsHtml}
     </div>`,
  ].join("");

  return {
    subject,
    html: shell({
      preheader: `Your meeting recap for "${d.title}" is now available.`,
      accentColor: "#059669",
      statusLabel: "Recap Shared",
      body,
    }),
  };
}
