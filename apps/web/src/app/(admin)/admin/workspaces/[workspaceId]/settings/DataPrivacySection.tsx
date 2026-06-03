"use client";

import { useState } from "react";
import {
  Download,
  LinkSimple,
  PlugsConnected,
  Eye,
  CalendarBlank,
} from "@phosphor-icons/react";
import s from "./PersonalInfoSection.module.css";
import x from "./SettingsShared.module.css";

export type ConnectionRow = {
  id: string;
  provider: string;
  label: string;
  status: string;
  connectedAt: string | null;
};

type Props = {
  connections: ConnectionRow[];
};

const PROVIDER_LABEL: Record<string, string> = {
  hospitable: "Hospitable",
  airbnb: "Airbnb",
  vrbo: "VRBO",
  google_calendar: "Google Calendar",
  stripe: "Stripe",
};

export function DataPrivacySection({ connections }: Props) {
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(true);

  return (
    <div>
      <header className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>Data &amp; privacy</h2>
        <p className={s.sectionSubtitle}>
          What we store, who sees it, and what leaves the platform.
        </p>
      </header>

      {/* Connected services */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Connected services</span>
        </div>
        <p className={s.cardHeaderSub}>
          Third-party integrations the owner has linked to Proxy.
        </p>
        <ul className={x.list}>
          {connections.length === 0 ? (
            <li className={x.listItem}>
              <div className={x.listItemIcon}>
                <LinkSimple size={16} weight="duotone" />
              </div>
              <div className={x.listItemMain}>
                <div className={x.listItemTitle}>No services connected.</div>
                <div className={x.listItemSub}>
                  Hospitable, Airbnb, VRBO, Google Calendar appear here once connected.
                </div>
              </div>
            </li>
          ) : (
            connections.map((c) => (
              <li key={c.id} className={x.listItem}>
                <div className={x.listItemIcon}>
                  <PlugsConnected size={16} weight="duotone" />
                </div>
                <div className={x.listItemMain}>
                  <div className={x.listItemTitle}>
                    {PROVIDER_LABEL[c.provider] ?? c.provider}
                  </div>
                  <div className={x.listItemSub}>
                    {c.label ? (
                      <>
                        <span>{c.label}</span>
                        <span aria-hidden>·</span>
                      </>
                    ) : null}
                    <span>
                      Connected{" "}
                      {c.connectedAt
                        ? new Date(c.connectedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                    <span aria-hidden>·</span>
                    <span
                      className={`${x.pill} ${
                        c.status === "connected" ? x.pillGreen : x.pillSlate
                      }`}
                    >
                      {c.status[0].toUpperCase() + c.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div className={x.listItemAction}>
                  <button type="button" className={s.btnGhost}>
                    Disconnect
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
        <div className={s.cardFooter}>
          <p className={s.cardFooterHint}>
            Disconnecting a service stops data sync. Historical records stay in Proxy.
          </p>
          <button type="button" className={s.btnSecondary}>
            Browse integrations
          </button>
        </div>
      </section>

      {/* Admin calendar integration */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Admin calendar</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Google Calendar</label>
              <span className={s.labelHint}>
                Meetings you create in Proxy will sync to your Google Calendar and include a Meet link for video calls.
              </span>
            </div>
            <div className={s.fieldCell}>
              <a href="/api/auth/google-calendar" className={s.btnSecondary} style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}>
                <CalendarBlank size={14} weight="duotone" />
                Connect Google Calendar
              </a>
              <p className={s.fieldHint}>
                You will be redirected to Google to authorize calendar access.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who sees what */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Visibility</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Owner-facing timeline</label>
              <span className={s.labelHint}>
                Proxy team can hide sensitive events from the owner&rsquo;s view.
              </span>
            </div>
            <div className={s.fieldCell}>
              <p className={s.fieldHint}>
                Admin-only events are tagged &ldquo;admin only&rdquo; and never appear in the owner workspace.
              </p>
              <button type="button" className={s.btnGhost}>
                <Eye size={14} weight="duotone" /> Review hidden events
              </button>
            </div>
          </div>

          <ToggleRow
            label="Product emails"
            hint="Monthly newsletter, tips, feature launches."
            checked={marketingOptIn}
            onChange={() => setMarketingOptIn((v) => !v)}
          />
          <ToggleRow
            label="Product analytics"
            hint="Anonymous usage to help Proxy improve."
            checked={analyticsOptIn}
            onChange={() => setAnalyticsOptIn((v) => !v)}
          />
        </div>
      </section>

      {/* Export */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Export data</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Full export</label>
              <span className={s.labelHint}>
                Everything Proxy has on this owner.
              </span>
            </div>
            <div className={s.fieldCell}>
              <button type="button" className={s.btnSecondary}>
                <Download size={14} weight="duotone" /> Request export
              </button>
              <p className={s.fieldHint}>
                Delivered as a ZIP of JSON within 24 hours.
              </p>
            </div>
          </div>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Payout CSV</label>
              <span className={s.labelHint}>Current year.</span>
            </div>
            <div className={s.fieldCell}>
              <button type="button" className={s.btnGhost}>
                <Download size={14} weight="duotone" /> Download payouts.csv
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className={s.row}>
      <div className={s.labelCell}>
        <label className={s.label}>{label}</label>
        <span className={s.labelHint}>{hint}</span>
      </div>
      <div className={s.fieldCell}>
        <label className={x.switch}>
          <input type="checkbox" checked={checked} onChange={onChange} />
          <span className={x.switchTrack} />
          <span className={x.switchThumb} />
        </label>
      </div>
    </div>
  );
}
