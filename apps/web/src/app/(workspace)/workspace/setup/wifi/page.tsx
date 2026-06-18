import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { WifiForm } from "./WifiForm";

export const metadata: Metadata = { title: "Wi-Fi and Tech" };
export const dynamic = "force-dynamic";

type WifiDetails = {
  provider?: string;
  ssid?: string;
  password?: string;
  router_location?: string;
  modem_location?: string;
  account_website?: string;
  account_username?: string;
  account_password?: string;
};

export default async function WifiPage({
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

  let property = null;
  if (propertyId) {
    const { data } = await supabase
      .from("properties")
      .select("id, wifi_details, updated_at")
      .eq("id", propertyId)
      .single();
    property = data;
  }

  const wifi = (property?.wifi_details as WifiDetails | null) ?? {};

  return (
    <StepShell
      track="property"
      stepNumber={7}
      title="Wi-Fi and tech"
      whyWeAsk="Guests expect reliable internet. We print a Wi-Fi card for the property and need billing access to troubleshoot outages."
      estimateMinutes={3}
      lastUpdated={property?.updated_at}
    >
      <WifiForm
        propertyId={property?.id ?? ""}
        initial={wifi}
        isEditing={Boolean(wifi.ssid)}
      />
    </StepShell>
  );
}
