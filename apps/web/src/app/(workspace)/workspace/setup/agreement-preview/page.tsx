import type { Metadata } from "next";
import {
  CheckCircle,
  CurrencyDollar,
  Handshake,
  SignOut,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { AgreementPreviewClient } from "./AgreementPreviewClient";

export const metadata: Metadata = { title: "Agreement Preview" };
export const dynamic = "force-dynamic";

const points = [
  {
    icon: <Handshake size={20} weight="duotone" />,
    title: "What Proxy does",
    items: [
      "List your property on Airbnb, Vrbo, and direct booking channels",
      "Handle guest communication, check-in, and check-out",
      "Coordinate cleaning, maintenance, and restocking",
      "Manage pricing strategy to maximize your revenue",
      "Provide monthly financial reports through the owner workspace",
    ],
  },
  {
    icon: <CheckCircle size={20} weight="duotone" />,
    title: "What you agree to",
    items: [
      "Keep the property guest-ready and well maintained",
      "Notify Proxy of any blocked dates at least 48 hours in advance",
      "Maintain homeowner insurance that covers short-term rentals",
      "Allow professional photography of the property",
      "Respond to urgent owner-only matters within 24 hours",
    ],
  },
  {
    icon: <CurrencyDollar size={20} weight="duotone" />,
    title: "Commission structure",
    items: [
      "Proxy earns a percentage of each booking, deducted before payout",
      "The exact rate is set in your signed agreement",
      "No hidden fees. Cleaning fees are passed through to guests",
      "Payouts arrive within 2 to 3 business days of guest checkout",
    ],
  },
  {
    icon: <SignOut size={20} weight="duotone" />,
    title: "How to end the agreement",
    items: [
      "Either party can terminate with 30 days written notice",
      "Existing reservations will be honored through checkout",
      "Your listing content and photos remain your property",
    ],
  },
];

export default async function AgreementPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ property?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const params = await searchParams;
  const propertyId = params?.property ?? null;

  let acknowledgedAt: string | null = null;
  if (propertyId) {
    const { data } = await supabase
      .from("properties")
      .select("agreement_acknowledged_at")
      .eq("id", propertyId)
      .single();
    acknowledgedAt = data?.agreement_acknowledged_at ?? null;
  }

  return (
    <StepShell
      track="property"
      stepNumber={1}
      title="Agreement preview"
      whyWeAsk="Before we get into the details, here is a plain-language summary of what the host agreement covers. No legal jargon."
      estimateMinutes={3}
      lastUpdated={acknowledgedAt}
    >
      <div className="flex flex-col gap-6">
        {points.map((section) => (
          <div
            key={section.title}
            className="rounded-2xl border p-6"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <span style={{ color: "var(--color-brand)" }}>
                {section.icon}
              </span>
              <h2
                className="text-base font-semibold tracking-tight"
                style={{ color: "var(--color-text-primary)" }}
              >
                {section.title}
              </h2>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {section.items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <span
                    className="mt-2 h-1 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--color-brand)" }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <AgreementPreviewClient
          propertyId={propertyId ?? ""}
          acknowledgedAt={acknowledgedAt}
        />
      </div>
    </StepShell>
  );
}
