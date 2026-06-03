"use client";

import { useState } from "react";
import {
  Bank,
  CreditCard,
  FileText,
  Download,
} from "@phosphor-icons/react";
import s from "./PersonalInfoSection.module.css";
import x from "./SettingsShared.module.css";

export type PayoutSchedule = "monthly_15" | "biweekly" | "weekly";

type Props = {
  hasBankOnFile: boolean;
  bankLast4?: string | null;
  bankName?: string | null;
  w9OnFile: boolean;
  ytdGrossCents: number;
  ytdNetCents: number;
  nextPayoutDate: string | null;
};

export function PaymentsPayoutSection({
  hasBankOnFile,
  bankLast4,
  bankName,
  w9OnFile,
  ytdGrossCents,
  ytdNetCents,
  nextPayoutDate,
}: Props) {
  const [schedule, setSchedule] = useState<PayoutSchedule>("monthly_15");

  return (
    <div>
      <header className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>Payments &amp; payout</h2>
        <p className={s.sectionSubtitle}>
          Where and when money moves between Proxy and the owner.
        </p>
      </header>

      {/* Summary metrics */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Year to date</span>
        </div>
        <div className={s.cardBody}>
          <div className={x.metricGrid}>
            <div className={x.metricCard}>
              <div className={x.metricLabel}>Gross revenue</div>
              <div className={x.metricValue}>{fmtCents(ytdGrossCents)}</div>
              <div className={x.metricSub}>Before platform fees.</div>
            </div>
            <div className={x.metricCard}>
              <div className={x.metricLabel}>Net payouts</div>
              <div className={x.metricValue}>{fmtCents(ytdNetCents)}</div>
              <div className={x.metricSub}>Deposited to bank.</div>
            </div>
            <div className={x.metricCard}>
              <div className={x.metricLabel}>Next payout</div>
              <div className={x.metricValue}>
                {nextPayoutDate
                  ? new Date(nextPayoutDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </div>
              <div className={x.metricSub}>Auto on the 15th.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Bank / payout method */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Payout method</span>
        </div>
        <ul className={x.list}>
          <li className={x.listItem}>
            <div className={x.listItemIcon}>
              <Bank size={16} weight="duotone" />
            </div>
            <div className={x.listItemMain}>
              {hasBankOnFile ? (
                <>
                  <div className={x.listItemTitle}>
                    {bankName ?? "Bank account"} •••• {bankLast4 ?? "1234"}
                  </div>
                  <div className={x.listItemSub}>
                    <span className={`${x.pill} ${x.pillGreen}`}>Primary</span>
                    <span>ACH direct deposit.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className={x.listItemTitle}>No bank account on file.</div>
                  <div className={x.listItemSub}>
                    Payouts will be held until a bank is connected.
                  </div>
                </>
              )}
            </div>
            <div className={x.listItemAction}>
              <button type="button" className={s.btnSecondary}>
                {hasBankOnFile ? "Change" : "Connect bank"}
              </button>
            </div>
          </li>
        </ul>
      </section>

      {/* Tax + payout cadence */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Schedule &amp; tax</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Payout cadence</label>
              <span className={s.labelHint}>When Proxy sweeps funds to bank.</span>
            </div>
            <div className={s.fieldCell}>
              <div className={s.segmented}>
                {(
                  [
                    { k: "monthly_15", label: "Monthly" },
                    { k: "biweekly", label: "Bi-weekly" },
                    { k: "weekly", label: "Weekly" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    className={`${s.segmentedBtn} ${
                      schedule === o.k ? s.segmentedBtnActive : ""
                    }`}
                    onClick={() => setSchedule(o.k)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>W-9 on file</label>
              <span className={s.labelHint}>
                Required for 1099 reporting.
              </span>
            </div>
            <div
              className={s.fieldCell}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <span className={`${x.pill} ${w9OnFile ? x.pillGreen : x.pillAmber}`}>
                {w9OnFile ? "On file" : "Missing"}
              </span>
              <button type="button" className={s.btnSecondary}>
                <FileText size={14} weight="duotone" />{" "}
                {w9OnFile ? "Replace W-9" : "Request W-9"}
              </button>
            </div>
          </div>

          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Tax forms</label>
              <span className={s.labelHint}>1099-K / 1099-NEC when issued.</span>
            </div>
            <div className={s.fieldCell}>
              <button type="button" className={s.btnSecondary} disabled>
                <Download size={14} weight="duotone" /> No forms for this year yet
              </button>
              <p className={s.fieldHint}>
                Generated each January for the previous tax year.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cards on file (for onboarding fee / tech fee) */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Cards on file</span>
        </div>
        <ul className={x.list}>
          <li className={x.listItem}>
            <div className={x.listItemIcon}>
              <CreditCard size={16} weight="duotone" />
            </div>
            <div className={x.listItemMain}>
              <div className={x.listItemTitle}>Visa •••• 4242</div>
              <div className={x.listItemSub}>
                <span>Charges tech fee monthly.</span>
                <span aria-hidden>·</span>
                <span>Expires 08/2028</span>
              </div>
            </div>
            <div className={x.listItemAction}>
              <button type="button" className={s.btnGhost}>Remove</button>
            </div>
          </li>
        </ul>
        <div className={s.cardFooter}>
          <p className={s.cardFooterHint}>
            Tech fee auto-charges the primary card. Payouts use bank account.
          </p>
          <button type="button" className={s.btnSecondary}>Add card</button>
        </div>
      </section>
    </div>
  );
}

function fmtCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
