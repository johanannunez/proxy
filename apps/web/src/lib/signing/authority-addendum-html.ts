import "server-only";

/**
 * The Decision Authority Addendum is defined entirely in code.
 * DocuSeal renders this HTML as a signable document.
 * Signature fields for Owner 1 and Owner 2 are injected via the API —
 * no PDF upload, no manual DocuSeal UI setup required.
 */

export const AUTHORITY_ADDENDUM_DOCUMENT_KEY = "decision_authority_addendum";

export const AUTHORITY_ADDENDUM_SUBMITTERS = [
  { name: "Owner 1" },
  { name: "Owner 2" },
] as const;

export const AUTHORITY_ADDENDUM_FIELDS = [
  {
    name: "Owner 1 Signature",
    type: "signature",
    submitter: "Owner 1",
    required: true,
  },
  {
    name: "Owner 2 Signature",
    type: "signature",
    submitter: "Owner 2",
    required: true,
  },
] as const;

export function buildAuthorityAddendumHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #1a1a1a;
    padding: 56px 72px;
    max-width: 800px;
    margin: 0 auto;
  }
  .header {
    text-align: center;
    margin-bottom: 36px;
    padding-bottom: 20px;
    border-bottom: 2px solid #1a1a1a;
  }
  .header h1 {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 17pt;
    font-weight: 700;
    letter-spacing: -0.3px;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  .header .subtitle {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #6b7280;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  h2 {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 28px;
    margin-bottom: 8px;
  }
  p {
    margin-bottom: 12px;
  }
  .recital {
    margin: 24px 0;
    padding: 16px 20px;
    background: #f8f7f6;
    border-left: 3px solid #1a1a1a;
  }
  .domain-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 20px;
    font-size: 10.5pt;
  }
  .domain-table th {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: left;
    padding: 8px 12px;
    background: #1a1a1a;
    color: #ffffff;
  }
  .domain-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
  }
  .domain-table tr:last-child td {
    border-bottom: none;
  }
  .signature-section {
    margin-top: 56px;
    padding-top: 24px;
    border-top: 1px solid #d1d5db;
  }
  .signature-section h2 {
    margin-top: 0;
    margin-bottom: 32px;
  }
  .signature-row {
    display: flex;
    gap: 48px;
    margin-bottom: 48px;
  }
  .signature-block {
    flex: 1;
  }
  .signature-block .role-label {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
    margin-bottom: 12px;
  }
  .signature-line {
    height: 48px;
    border-bottom: 1px solid #1a1a1a;
    margin-bottom: 8px;
  }
  .signature-meta {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>

<div class="header">
  <h1>Decision Authority Addendum</h1>
  <div class="subtitle">Proxy Co-Hosting Platform &mdash; Workspace Governance Agreement</div>
</div>

<div class="recital">
  <p>This Decision Authority Addendum ("Addendum") is entered into by the co-owners identified below and governs how operating decisions are allocated on the Proxy platform. By signing below, each co-owner agrees to the authority structure defined in their workspace settings at the time of execution.</p>
</div>

<h2>1. Purpose</h2>
<p>This Addendum establishes a clear allocation of decision-making authority among co-owners to ensure smooth operations, reduce ambiguity, and provide each co-owner with defined responsibility over their assigned domain.</p>

<h2>2. Decision Domains</h2>
<p>The co-owners of this workspace have designated authority across the following domains as configured in the Proxy platform:</p>

<table class="domain-table">
  <thead>
    <tr>
      <th>Domain</th>
      <th>Scope of Authority</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Documents &amp; Legal</strong></td>
      <td>Lease agreements, addenda, disclosures, and all binding legal documents executed on behalf of the workspace.</td>
    </tr>
    <tr>
      <td><strong>Finances &amp; Payouts</strong></td>
      <td>Payout disbursement, expense approvals, owner distributions, and financial reporting.</td>
    </tr>
    <tr>
      <td><strong>Operations &amp; Maintenance</strong></td>
      <td>Maintenance requests, vendor coordination, property access, and day-to-day operational decisions.</td>
    </tr>
  </tbody>
</table>

<h2>3. Guest Escalation</h2>
<p>Guest escalations will be routed to the co-owners designated in the workspace escalation settings at the time of the escalation event. Escalation routing may be updated at any time by executing a new Addendum.</p>

<h2>4. Amendments</h2>
<p>This Addendum may be amended only by mutual written agreement of all co-owners, executed through the Proxy platform. Each new signed Addendum supersedes all prior versions.</p>

<h2>5. Term</h2>
<p>This Addendum remains in effect until superseded by a new signed Addendum or until the workspace is dissolved, whichever occurs first.</p>

<h2>6. Governing Law</h2>
<p>This Addendum is governed by the laws of the jurisdiction in which the managed properties are located, or as otherwise agreed in writing by the parties.</p>

<div class="signature-section">
  <h2>Signatures</h2>
  <div class="signature-row">
    <div class="signature-block">
      <div class="role-label">Co-Owner 1</div>
      <div class="signature-line"></div>
      <div class="signature-meta">
        <span>Signature</span>
        <span>Date</span>
      </div>
    </div>
    <div class="signature-block">
      <div class="role-label">Co-Owner 2</div>
      <div class="signature-line"></div>
      <div class="signature-meta">
        <span>Signature</span>
        <span>Date</span>
      </div>
    </div>
  </div>
</div>

</body>
</html>`;
}
