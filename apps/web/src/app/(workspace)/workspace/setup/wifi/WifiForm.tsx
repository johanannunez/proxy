"use client";

import { useActionState, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { saveWifi, type SaveWifiState } from "./actions";

type WifiInitial = {
  provider?: string;
  ssid?: string;
  password?: string;
  router_location?: string;
  modem_location?: string;
  account_website?: string;
  account_username?: string;
  account_password?: string;
};

const initialState: SaveWifiState = {};

export function WifiForm({
  propertyId,
  initial,
  isEditing,
}: {
  propertyId: string;
  initial: WifiInitial;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveWifi, initialState);
  const err = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="property_id" value={propertyId} />

      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm"
          style={{ borderColor: "#f1c4c4", backgroundColor: "#fdf4f4", color: "#8a1f1f" }}
        >
          <WarningCircle size={18} weight="fill" style={{ color: "#c0372a" }} />
          <span>{state.error}</span>
        </div>
      ) : null}

      <Section title="Network details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="provider" label="Internet provider" defaultValue={initial.provider} placeholder="e.g. Xfinity, AT&T" error={err("provider")} />
          <TextInput name="ssid" label="Network name (SSID)" defaultValue={initial.ssid} placeholder="MyHomeNetwork" error={err("ssid")} />
          <TextInput name="password" label="Wi-Fi password" defaultValue={initial.password} placeholder="The one guests connect with" error={err("password")} />
          <TextInput name="router_location" label="Router location" defaultValue={initial.router_location} placeholder="e.g. Living room closet, top shelf" error={err("router_location")} />
        </div>
      </Section>

      <Section title="Equipment location">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="modem_location" label="Modem location" defaultValue={initial.modem_location} placeholder="e.g. Garage, near the panel" error={err("modem_location")} />
        </div>
      </Section>

      <Section title="Account admin (for billing and troubleshooting)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextInput name="account_website" label="ISP website URL" defaultValue={initial.account_website} placeholder="https://xfinity.com" error={err("account_website")} />
          <TextInput name="account_username" label="Account username" defaultValue={initial.account_username} placeholder="your-email@example.com" error={err("account_username")} />
          <TextInput name="account_password" label="Account password" defaultValue={initial.account_password} placeholder="Your ISP login password" type="password" error={err("account_password")} />
        </div>
        <p className="mt-3 text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
          This is encrypted and only used if we need to troubleshoot an outage for your guests.
        </p>
      </Section>

      <StepSaveBar pending={pending} isEditing={isEditing} />
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-6" style={{ borderColor: "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)" }}>
      <h2 className="mb-4 text-base font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>{title}</h2>
      {children}
    </section>
  );
}

function TextInput({
  name, label, placeholder, defaultValue, error, type = "text",
}: {
  name: string; label: string; placeholder?: string; defaultValue?: string; error?: string; type?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-tertiary)" }}>
        {label}
      </label>
      <input id={id} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
        style={{ borderColor: error ? "#e3867a" : "var(--color-warm-gray-200)", backgroundColor: "var(--color-white)", color: "var(--color-text-primary)" }}
      />
      {error ? (
        <p className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#c0372a" }}>
          <WarningCircle size={12} weight="fill" />{error}
        </p>
      ) : null}
    </div>
  );
}
