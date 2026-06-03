"use client";

import { useState } from "react";
import s from "./PersonalInfoSection.module.css";
import x from "./SettingsShared.module.css";

type Channel = "bookings" | "payouts" | "messages" | "tasks" | "invoices" | "system";

const CHANNELS: Array<{ key: Channel; label: string; sub: string }> = [
  { key: "bookings", label: "Bookings", sub: "New reservation, change, cancellation." },
  { key: "payouts",  label: "Payouts",  sub: "Payout sent, failed, or adjusted." },
  { key: "messages", label: "Messages", sub: "New message in Proxy inbox." },
  { key: "tasks",    label: "Tasks",    sub: "Task assigned, due soon, overdue." },
  { key: "invoices", label: "Invoices", sub: "Invoice issued, paid, failed." },
  { key: "system",   label: "System",   sub: "Weekly digest, platform updates, security." },
];

type Prefs = Record<Channel, { email: boolean; sms: boolean }>;
type Digest = "off" | "daily" | "weekly";

const DEFAULT_PREFS: Prefs = {
  bookings:  { email: true,  sms: true  },
  payouts:   { email: true,  sms: false },
  messages:  { email: true,  sms: false },
  tasks:     { email: true,  sms: false },
  invoices:  { email: true,  sms: false },
  system:    { email: false, sms: false },
};

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [digest, setDigest] = useState<Digest>("weekly");

  function toggle(channel: Channel, kind: "email" | "sms") {
    setPrefs((p) => ({
      ...p,
      [channel]: { ...p[channel], [kind]: !p[channel][kind] },
    }));
  }

  return (
    <div>
      <header className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>Notifications</h2>
        <p className={s.sectionSubtitle}>
          When and how the owner hears from Proxy.
        </p>
      </header>

      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Per-event delivery</span>
        </div>
        <p className={s.cardHeaderSub}>
          Toggle the channels to use for each kind of event. In-app notifications always fire.
        </p>
        <div style={{ padding: "10px 22px 4px", display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: 8, fontSize: 11, color: "#8A9AAB", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
          <span>Event</span>
          <span style={{ textAlign: "center" }}>Email</span>
          <span style={{ textAlign: "center" }}>SMS</span>
        </div>
        <ul className={x.list} style={{ margin: 0 }}>
          {CHANNELS.map((c) => (
            <li
              key={c.key}
              className={x.listItem}
              style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: 8, alignItems: "center" }}
            >
              <div>
                <div className={x.listItemTitle}>{c.label}</div>
                <div className={x.listItemSub}>{c.sub}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Switch
                  checked={prefs[c.key].email}
                  onChange={() => toggle(c.key, "email")}
                  ariaLabel={`${c.label} email`}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Switch
                  checked={prefs[c.key].sms}
                  onChange={() => toggle(c.key, "sms")}
                  ariaLabel={`${c.label} SMS`}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Digest cadence</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Summary email</label>
              <span className={s.labelHint}>
                Recap of activity between real-time pings.
              </span>
            </div>
            <div className={s.fieldCell}>
              <div className={s.segmented}>
                {(["off", "daily", "weekly"] as Digest[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`${s.segmentedBtn} ${
                      digest === d ? s.segmentedBtnActive : ""
                    }`}
                    onClick={() => setDigest(d)}
                  >
                    {d === "off" ? "Off" : d[0].toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className={s.cardFooter}>
          <p className={s.cardFooterHint}>
            Preferences save on change. Persistence ships with the prefs table next.
          </p>
        </div>
      </section>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <label className={x.switch} aria-label={ariaLabel}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={x.switchTrack} />
      <span className={x.switchThumb} />
    </label>
  );
}
