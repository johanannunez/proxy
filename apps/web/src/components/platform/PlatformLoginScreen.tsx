import { Buildings, CurrencyDollar, ChartLineUp, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { LoginForm } from "@/app/(marketing)/login/LoginForm";
import styles from "./PlatformLoginScreen.module.css";

/**
 * Platform Console sign-in — the OLED "mission control" front door.
 *
 * Rendered by the shared /login page only when the destination is the platform
 * console, so platform staff get a sign-in that reads as the platform (not the
 * owner "your workspace" portal). It reuses the shared LoginForm (whose inputs are
 * CSS-var driven) and the console's [data-platform-root] token layer; the wrapper
 * just re-points the form's surface/text/border tokens to the dark palette, so the
 * form renders on OLED with no change to the shared component.
 */

const CAPABILITIES = [
  { icon: Buildings, label: "Every subscriber agency under management" },
  { icon: CurrencyDollar, label: "Agency-operating MRR, reconciled across billing" },
  { icon: ChartLineUp, label: "Activation funnel, retention, and growth" },
  { icon: ShieldCheck, label: "Support access into any agency, with a paper trail" },
];

export function PlatformLoginScreen({ redirectTo }: { redirectTo: string }) {
  return (
    <div data-platform-root className={styles.screen}>
      <div className={styles.grid}>
        <section className={styles.intro}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true" />
            <span className={styles.brandText}>
              <span className={styles.brandName}>Proxy</span>
              <span className={styles.brandEyebrow}>Platform</span>
            </span>
          </div>

          <p className={styles.kicker}>Mission control</p>
          <h1 className={styles.headline}>The view over every agency you run.</h1>
          <p className={styles.sub}>
            Reconciled revenue, activation, retention, and system health. Every vital sign on
            one screen.
          </p>

          <ul className={styles.capabilities}>
            {CAPABILITIES.map(({ icon: Icon, label }) => (
              <li key={label} className={styles.capability}>
                <span className={styles.capIcon}>
                  <Icon size={17} weight="duotone" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.card}>
            <p className={styles.cardKicker}>Platform access</p>
            <h2 className={styles.cardTitle}>Sign in</h2>
            <p className={styles.cardSub}>Superadmin access to the Proxy platform.</p>

            <LoginForm redirectTo={redirectTo} />

            <p className={styles.note}>
              This is the platform console, not an agency workspace. Agency staff and owners
              sign in at their own workspace.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
