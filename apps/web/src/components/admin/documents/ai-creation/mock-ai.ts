import type { AIGeneratedIntelligence, AgentStep, ProxyTemplateRecord } from "./types";

export const AGENT_STEPS: AgentStep[] = [
  { id: "analyze", label: "Analyzing document type", status: "pending" },
  { id: "draft", label: "Drafting document structure", status: "pending" },
  { id: "clauses", label: "Applying property law clauses", status: "pending" },
  { id: "signers", label: "Configuring signers and gate step", status: "pending" },
  { id: "intelligence", label: "Filling template intelligence", status: "pending" },
];

export const MOCK_GENERATED: AIGeneratedIntelligence = {
  templateName: "Short-Term Rental Agreement",
  documentKey: "short_term_rental_agreement",
  description:
    "Governs short-term rentals listed on Airbnb and VRBO. Covers rental period, payment, house rules, and liability. Signed by Owner then countersigned by Proxy.",
  signerRoles: ["Owner", "Proxy"],
  gateStep: "1",
  documentBody: `SHORT-TERM RENTAL AGREEMENT

This Short-Term Rental Agreement ("Agreement") is entered into as of the date of last signature below, between the property owner ("Owner") and Proxy Co-Hosting, LLC ("Proxy"), acting as the authorized co-host and property manager.

1. PROPERTY
   The property subject to this agreement is located at the address on file with Proxy ("Property"). Owner authorizes Proxy to list and manage the Property on short-term rental platforms including Airbnb and VRBO.

2. RENTAL PERIOD AND RATES
   Proxy shall manage bookings for nightly stays not to exceed thirty (30) consecutive nights per guest. Nightly rates, cleaning fees, and platform fees shall be set by Proxy in accordance with dynamic pricing guidelines agreed upon separately.

3. OWNER OBLIGATIONS
   Owner shall maintain the Property in a clean, safe, and rentable condition. Owner shall provide access to the Property and ensure all appliances, utilities, and amenities are functional prior to each guest check-in.

4. PROXY OBLIGATIONS
   Proxy shall handle guest communications, booking management, check-in coordination, and post-stay reviews. Proxy shall remit net rental proceeds to Owner within five (5) business days of each guest checkout, less the management fee.

5. MANAGEMENT FEE
   Owner agrees to pay Proxy a management fee of [__]% of gross rental revenue, as specified in the separately executed Management Fee Schedule.

6. UNAUTHORIZED SUBLETTING
   Owner shall not enter into any separate rental agreements for the Property during active Proxy management periods without prior written consent from Proxy.

7. LIABILITY
   Owner assumes full liability for the condition of the Property. Proxy shall not be held liable for guest damages beyond the security deposit amount collected. Owner is encouraged to maintain short-term rental insurance.

8. TERMINATION
   Either party may terminate this Agreement with thirty (30) days written notice. Outstanding bookings at time of termination shall be honored unless mutually agreed otherwise.

9. GOVERNING LAW
   This Agreement shall be governed by the laws of the state in which the Property is located.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date below.`,
};

export const PROXY_TEMPLATES: ProxyTemplateRecord[] = [
  {
    id: "proxy-1",
    name: "Short-Term Rental Agreement",
    description: "Governs Airbnb and VRBO listings. Covers rental period, payment, and liability.",
    category: "Agreement",
    signerRoles: ["Owner", "Proxy"],
    gateStep: "1",
    previewSnippet: "This Short-Term Rental Agreement is entered into between the property owner and Proxy Co-Hosting, LLC...",
  },
  {
    id: "proxy-2",
    name: "Pet Damage Addendum",
    description: "Supplements the rental agreement for properties that allow pets. Defines damage liability and deposit terms.",
    category: "Addendum",
    signerRoles: ["Owner", "Proxy"],
    gateStep: "1",
    previewSnippet: "This addendum modifies the Short-Term Rental Agreement to address pet-related damage and liability...",
  },
  {
    id: "proxy-3",
    name: "Owner Authorization Letter",
    description: "Authorizes Proxy to list the property on OTAs and act on the owner's behalf.",
    category: "Authorization",
    signerRoles: ["Owner"],
    gateStep: "2",
    previewSnippet: "I, the undersigned property owner, hereby authorize Proxy Co-Hosting, LLC to list and manage...",
  },
  {
    id: "proxy-4",
    name: "Move-In Inspection Checklist",
    description: "Documents property condition at the start of a management relationship.",
    category: "Policy",
    signerRoles: ["Owner", "Proxy"],
    gateStep: "3",
    previewSnippet: "This checklist documents the agreed-upon condition of the property at the commencement of management...",
  },
  {
    id: "proxy-5",
    name: "Management Fee Schedule",
    description: "Defines commission rate, cleaning fee split, and payout schedule.",
    category: "Agreement",
    signerRoles: ["Owner", "Proxy"],
    gateStep: "2",
    previewSnippet: "Owner agrees to pay Proxy a management fee as specified herein, calculated as a percentage of gross...",
  },
];

export const EXAMPLE_PROMPTS = [
  "Rental host agreement for Airbnb and VRBO — owner signs, I countersign",
  "Credit card authorization — owner authorizes charges for deposit and incidentals",
  "Property listing authorization — owner gives permission to list on all platforms",
  "Short-term permit acknowledgment — owner confirms they hold required local permits",
];
