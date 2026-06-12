"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Circle,
  CircleNotch,
  EnvelopeSimple,
  LockSimple,
  RocketLaunch,
  Sparkle,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { CustomSelect } from "@/components/admin/CustomSelect";
import { isValidOrgSlug, normalizeOrgSlug, RESERVED_ORG_SLUGS } from "@/lib/organizations/slug";
import type { OrgPlanTier } from "@/types/organizations";
import {
  checkSubdomainAvailability,
  createOrganization,
  createStripeSubscription,
} from "./signup-actions";
import {
  INDUSTRY_OPTIONS,
  PLAN_CARDS,
  SIGNUP_STEPS,
  type AccountDraft,
  type CompanyDraft,
  type SignupStep,
  type SubdomainCheck,
} from "./signup-types";
import styles from "./SignupFlow.module.css";

export type BillingConfig = {
  publishableKey: string | null;
  proConfigured: boolean;
  whiteLabelConfigured: boolean;
};

type SignupSuccess = {
  orgId: string;
  slug: string;
  planTier: OrgPlanTier;
  requiresEmailConfirmation: boolean;
};

const PASSWORD_REQUIREMENTS = [
  { key: "length", label: "At least 8 characters", check: (p: string) => p.length >= 8 },
  { key: "number", label: "Contains a number", check: (p: string) => /\d/.test(p) },
];

const STEP_COPY: Record<SignupStep, { kicker: string; title: string; sub: string }> = {
  1: {
    kicker: "Step 1 of 4",
    title: "Create your account",
    sub: "You will be the owner of your company workspace.",
  },
  2: {
    kicker: "Step 2 of 4",
    title: "Set up your company",
    sub: "This becomes your branded client portal address.",
  },
  3: {
    kicker: "Step 3 of 4",
    title: "Pick your plan",
    sub: "Start free and upgrade any time. No contracts, cancel whenever.",
  },
  4: {
    kicker: "Step 4 of 4",
    title: "Payment details",
    sub: "Your subscription starts today and renews monthly.",
  },
};

function parseStep(raw: string | null): SignupStep {
  const n = Number(raw);
  if (n === 2 || n === 3 || n === 4) return n;
  return 1;
}

export function SignupFlow({ billing }: { billing: BillingConfig }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const step = parseStep(searchParams.get("step"));

  const [account, setAccount] = useState<AccountDraft>({
    fullName: "",
    email: "",
    password: "",
  });
  const [company, setCompany] = useState<CompanyDraft>({
    companyName: "",
    slug: "",
    industry: "property_management",
  });
  /** True once the user types in the slug field directly; stops prefill. */
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugCheck, setSlugCheck] = useState<SubdomainCheck>({ state: "idle" });
  const [planTier, setPlanTier] = useState<OrgPlanTier>("pro");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SignupSuccess | null>(null);
  /** Set once the org exists so a payment retry never re-creates it. */
  const createdOrgRef = useRef<{ orgId: string; requiresEmailConfirmation: boolean } | null>(null);

  const accountComplete =
    account.fullName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) &&
    PASSWORD_REQUIREMENTS.every((r) => r.check(account.password));

  const companyComplete =
    company.companyName.trim().length > 0 &&
    isValidOrgSlug(company.slug) &&
    slugCheck.state === "available";

  const goToStep = useCallback(
    (next: SignupStep) => {
      setSubmitError(null);
      router.push(`/signup?step=${next}`, { scroll: false });
    },
    [router],
  );

  // Guard direct deep links: data lives in memory, so jumping ahead without
  // the earlier steps bounces back to the first incomplete one.
  useEffect(() => {
    if (success) return;
    if (step >= 2 && !accountComplete) {
      router.replace("/signup?step=1", { scroll: false });
    } else if (step >= 3 && !companyComplete) {
      router.replace("/signup?step=2", { scroll: false });
    } else if (step === 4 && planTier === "starter") {
      router.replace("/signup?step=3", { scroll: false });
    }
  }, [step, accountComplete, companyComplete, planTier, router, success]);

  // Debounced live subdomain availability check.
  useEffect(() => {
    const slug = company.slug;
    if (slug.length === 0) {
      setSlugCheck({ state: "idle" });
      return;
    }
    if (RESERVED_ORG_SLUGS.includes(slug)) {
      setSlugCheck({ state: "invalid", reason: "That subdomain is reserved." });
      return;
    }
    if (!isValidOrgSlug(slug)) {
      setSlugCheck({
        state: "invalid",
        reason: "3 to 32 characters: lowercase letters, numbers, and hyphens.",
      });
      return;
    }
    setSlugCheck({ state: "checking" });
    let stale = false;
    const timer = setTimeout(() => {
      checkSubdomainAvailability(slug)
        .then(({ available }) => {
          if (stale) return;
          setSlugCheck(available ? { state: "available" } : { state: "taken" });
        })
        .catch(() => {
          if (!stale) setSlugCheck({ state: "idle" });
        });
    }, 400);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [company.slug]);

  const submitOrganization = useCallback(
    async (tier: OrgPlanTier) => {
      if (createdOrgRef.current) return createdOrgRef.current;
      const result = await createOrganization({
        name: company.companyName,
        slug: company.slug,
        planTier: tier,
        ownerEmail: account.email,
        ownerName: account.fullName,
        ownerPassword: account.password,
      });
      if (result.error || !result.orgId) {
        throw new Error(result.error ?? "Something went wrong. Please try again.");
      }
      createdOrgRef.current = {
        orgId: result.orgId,
        requiresEmailConfirmation: result.requiresEmailConfirmation,
      };
      return createdOrgRef.current;
    },
    [account, company],
  );

  const finishOnPlan = useCallback(
    async (tier: OrgPlanTier) => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        const created = await submitOrganization(tier);
        setSuccess({
          orgId: created.orgId,
          slug: company.slug,
          planTier: tier,
          requiresEmailConfirmation: created.requiresEmailConfirmation,
        });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setSubmitting(false);
      }
    },
    [company.slug, submitOrganization],
  );

  const stripePromise = useMemo<Promise<StripeJs | null> | null>(() => {
    if (!billing.publishableKey) return null;
    return loadStripe(billing.publishableKey);
  }, [billing.publishableKey]);

  const selectedPlanConfigured =
    planTier === "pro"
      ? billing.proConfigured
      : planTier === "white_label"
        ? billing.whiteLabelConfigured
        : true;

  const paymentReady =
    Boolean(stripePromise) && selectedPlanConfigured;

  const motionProps = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 28 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -28 },
      };

  const copy = STEP_COPY[step];
  const railStepState = (id: SignupStep) =>
    success || id < step ? "done" : id === step ? "active" : "todo";

  return (
    <div className={styles.shell}>
      {/* ── Brand rail ── */}
      <aside className={styles.rail}>
        <div className={styles.railTop}>
          <Link href="/" className={styles.railBrand} aria-label="Proxy home">
            <Image
              src="/brand/logo-mark-white-v2.png"
              alt=""
              width={36}
              height={36}
              style={{ width: 36, height: 36, objectFit: "contain" }}
            />
            <span className={styles.railWordmark}>Proxy</span>
          </Link>
          <h1 className={styles.railHeadline}>
            The document platform <em>property managers trust</em>.
          </h1>
          <p className={styles.railSub}>
            Forms, signatures, and a branded client portal. Set up in minutes,
            send your first document today.
          </p>
          <nav aria-label="Signup progress" className={styles.railSteps}>
            {SIGNUP_STEPS.map(({ id, label }) => {
              const state = railStepState(id);
              return (
                <div
                  key={id}
                  className={`${styles.railStep} ${
                    state === "active"
                      ? styles.railStepActive
                      : state === "done"
                        ? styles.railStepDone
                        : ""
                  }`}
                  aria-current={state === "active" ? "step" : undefined}
                >
                  <span className={styles.railStepIndex}>
                    {state === "done" ? <Check size={13} weight="bold" /> : id}
                  </span>
                  <span className={styles.railStepLabel}>{label}</span>
                </div>
              );
            })}
          </nav>
        </div>
        <p className={styles.railFoot}>
          Free to start. No credit card required on the Starter plan.
        </p>
      </aside>

      {/* ── Mobile header ── */}
      <header className={styles.mobileHeader}>
        <Link href="/" className={styles.railBrand} aria-label="Proxy home">
          <Image
            src="/brand/logo-mark-white-v2.png"
            alt=""
            width={28}
            height={28}
            style={{ width: 28, height: 28, objectFit: "contain" }}
          />
          <span className={styles.railWordmark} style={{ fontSize: 16 }}>
            Proxy
          </span>
        </Link>
        <div className={styles.mobileDots} aria-hidden="true">
          {SIGNUP_STEPS.map(({ id }) => (
            <span
              key={id}
              className={`${styles.mobileDot} ${id === step && !success ? styles.mobileDotActive : ""}`}
            />
          ))}
        </div>
      </header>

      {/* ── Step panel ── */}
      <main className={styles.panel}>
        <div
          className={`${styles.panelInner} ${step === 3 && !success ? styles.panelInnerWide : ""}`}
        >
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div key="success" {...motionProps} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                <SuccessPanel success={success} />
              </motion.div>
            ) : (
              <motion.div key={step} {...motionProps} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
                <p className={styles.stepKicker}>{copy.kicker}</p>
                <h2 className={styles.stepTitle}>{copy.title}</h2>
                <p className={styles.stepSub}>{copy.sub}</p>

                {step === 1 && (
                  <StepAccount
                    account={account}
                    onChange={setAccount}
                    canContinue={accountComplete}
                    onContinue={() => goToStep(2)}
                  />
                )}

                {step === 2 && (
                  <StepCompany
                    company={company}
                    slugCheck={slugCheck}
                    onChange={(next) => {
                      setCompany((prev) => {
                        // Prefill the slug from the company name until the
                        // user edits the slug field directly.
                        if (next.companyName !== prev.companyName && !slugEdited) {
                          return { ...next, slug: normalizeOrgSlug(next.companyName) };
                        }
                        return next;
                      });
                    }}
                    onSlugEdit={(slug) => {
                      setSlugEdited(true);
                      setCompany((prev) => ({ ...prev, slug }));
                    }}
                    canContinue={companyComplete}
                    onBack={() => goToStep(1)}
                    onContinue={() => goToStep(3)}
                  />
                )}

                {step === 3 && (
                  <StepPlan
                    planTier={planTier}
                    onSelect={setPlanTier}
                    submitting={submitting}
                    submitError={submitError}
                    onBack={() => goToStep(2)}
                    onContinue={() => {
                      if (planTier === "starter") {
                        void finishOnPlan("starter");
                      } else {
                        goToStep(4);
                      }
                    }}
                  />
                )}

                {step === 4 &&
                  (paymentReady && stripePromise ? (
                    <Elements stripe={stripePromise}>
                      <StepPayment
                        planTier={planTier as "pro" | "white_label"}
                        companySlug={company.slug}
                        submitOrganization={submitOrganization}
                        onSuccess={(requiresEmailConfirmation, orgId) =>
                          setSuccess({
                            orgId,
                            slug: company.slug,
                            planTier,
                            requiresEmailConfirmation,
                          })
                        }
                        onBack={() => goToStep(3)}
                      />
                    </Elements>
                  ) : (
                    <PaymentUnavailable
                      submitting={submitting}
                      submitError={submitError}
                      onStartFree={() => {
                        setPlanTier("starter");
                        void finishOnPlan("starter");
                      }}
                      onBack={() => goToStep(3)}
                    />
                  ))}

                {step === 1 && (
                  <p className={styles.loginHint}>
                    Already have an account? <Link href="/login">Log in</Link>
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

/* ── Step 1: account ─────────────────────────────────────────── */

function StepAccount({
  account,
  onChange,
  canContinue,
  onContinue,
}: {
  account: AccountDraft;
  onChange: (next: AccountDraft) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const [emailError, setEmailError] = useState("");
  const showReqs = account.password.length > 0;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) onContinue();
      }}
    >
      <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label htmlFor="signup-name" className={styles.label}>
            Full name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            placeholder="Jordan Alvarez"
            className={styles.input}
            value={account.fullName}
            onChange={(e) => onChange({ ...account, fullName: e.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="signup-email" className={styles.label}>
            Work email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="jordan@bluedoorpm.com"
            className={`${styles.input} ${emailError ? styles.inputError : ""}`}
            value={account.email}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "signup-email-error" : undefined}
            onChange={(e) => {
              onChange({ ...account, email: e.target.value });
              if (emailError) setEmailError("");
            }}
            onBlur={(e) => {
              const value = e.target.value;
              if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                setEmailError("Please enter a valid email address.");
              }
            }}
          />
          {emailError && (
            <span id="signup-email-error" className={styles.fieldError}>
              {emailError}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="signup-password" className={styles.label}>
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            className={styles.input}
            value={account.password}
            onChange={(e) => onChange({ ...account, password: e.target.value })}
          />
          {showReqs && (
            <div className={styles.reqs}>
              {PASSWORD_REQUIREMENTS.map((req) => {
                const met = req.check(account.password);
                return (
                  <span
                    key={req.key}
                    className={`${styles.req} ${met ? styles.reqMet : ""}`}
                  >
                    {met ? (
                      <CheckCircle size={14} weight="fill" />
                    ) : (
                      <Circle size={14} />
                    )}
                    {req.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <span />
        <button type="submit" className={styles.btnPrimary} disabled={!canContinue}>
          Continue
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>
    </form>
  );
}

/* ── Step 2: company + subdomain ─────────────────────────────── */

function StepCompany({
  company,
  slugCheck,
  onChange,
  onSlugEdit,
  canContinue,
  onBack,
  onContinue,
}: {
  company: CompanyDraft;
  slugCheck: SubdomainCheck;
  onChange: (next: CompanyDraft) => void;
  onSlugEdit: (slug: string) => void;
  canContinue: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [slugFocused, setSlugFocused] = useState(false);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) onContinue();
      }}
    >
      <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label htmlFor="signup-company" className={styles.label}>
            Company name
          </label>
          <input
            id="signup-company"
            type="text"
            autoComplete="organization"
            placeholder="Blue Door Property Management"
            className={styles.input}
            value={company.companyName}
            onChange={(e) => onChange({ ...company, companyName: e.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="signup-slug" className={styles.label}>
            Your subdomain
          </label>
          <div
            className={`${styles.slugWrap} ${slugFocused ? styles.slugWrapFocus : ""} ${
              slugCheck.state === "taken" || slugCheck.state === "invalid"
                ? styles.slugWrapError
                : ""
            }`}
          >
            <input
              id="signup-slug"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="bluedoor"
              className={styles.slugInput}
              value={company.slug}
              aria-invalid={slugCheck.state === "taken" || slugCheck.state === "invalid"}
              aria-describedby="signup-slug-status"
              onFocus={() => setSlugFocused(true)}
              onBlur={() => setSlugFocused(false)}
              onChange={(e) =>
                onSlugEdit(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
            />
            <span className={styles.slugSuffix}>.myproxyhost.com</span>
          </div>
          <div
            id="signup-slug-status"
            className={`${styles.slugStatus} ${
              slugCheck.state === "available"
                ? styles.slugStatusAvailable
                : slugCheck.state === "taken" || slugCheck.state === "invalid"
                  ? styles.slugStatusTaken
                  : styles.slugStatusChecking
            }`}
            role="status"
            aria-live="polite"
          >
            {slugCheck.state === "checking" && (
              <>
                <CircleNotch size={13} className={styles.spin} />
                Checking availability...
              </>
            )}
            {slugCheck.state === "available" && (
              <>
                <CheckCircle size={14} weight="fill" />
                {company.slug}.myproxyhost.com is available
              </>
            )}
            {slugCheck.state === "taken" && (
              <>
                <XCircle size={14} weight="fill" />
                That subdomain is taken. Try another.
              </>
            )}
            {slugCheck.state === "invalid" && (
              <>
                <XCircle size={14} weight="fill" />
                {slugCheck.reason}
              </>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="signup-industry" className={styles.label}>
            Industry
          </label>
          <CustomSelect
            id="signup-industry"
            value={company.industry}
            options={INDUSTRY_OPTIONS}
            onChange={(industry) => onChange({ ...company, industry })}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.btnGhost} onClick={onBack}>
          <ArrowLeft size={15} weight="bold" />
          Back
        </button>
        <button type="submit" className={styles.btnPrimary} disabled={!canContinue}>
          Continue
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>
    </form>
  );
}

/* ── Step 3: plan selection ──────────────────────────────────── */

function StepPlan({
  planTier,
  onSelect,
  submitting,
  submitError,
  onBack,
  onContinue,
}: {
  planTier: OrgPlanTier;
  onSelect: (tier: OrgPlanTier) => void;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <div className={styles.planGrid} role="radiogroup" aria-label="Plan">
        {PLAN_CARDS.map((plan) => {
          const selected = plan.tier === planTier;
          return (
            <button
              key={plan.tier}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`${styles.planCard} ${selected ? styles.planCardSelected : ""}`}
              onClick={() => onSelect(plan.tier)}
            >
              {plan.highlighted && (
                <span className={styles.planBadge}>Most popular</span>
              )}
              <span className={styles.planName}>
                {plan.name}
                <span className={styles.planCheck} aria-hidden="true">
                  <Check size={12} weight="bold" />
                </span>
              </span>
              <span className={styles.planPrice}>
                <span className={styles.planPriceAmount}>
                  {plan.priceMonthly === null ? "Free" : `$${plan.priceMonthly}`}
                </span>
                {plan.priceMonthly !== null && (
                  <span className={styles.planPricePeriod}>per month</span>
                )}
              </span>
              <span className={styles.planTagline}>{plan.tagline}</span>
              <ul className={styles.planFeatures}>
                {plan.features.map((feature) => (
                  <li key={feature} className={styles.planFeature}>
                    <Check size={13} weight="bold" className={styles.planFeatureIcon} />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {submitError && (
        <div className={styles.alertError} role="alert">
          <WarningCircle size={17} weight="fill" />
          {submitError}
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.btnGhost} onClick={onBack} disabled={submitting}>
          <ArrowLeft size={15} weight="bold" />
          Back
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onContinue}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <CircleNotch size={16} className={styles.spin} />
              Creating workspace...
            </>
          ) : planTier === "starter" ? (
            <>
              Create my workspace
              <RocketLaunch size={16} weight="bold" />
            </>
          ) : (
            <>
              Continue to payment
              <ArrowRight size={16} weight="bold" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Step 4: payment (Stripe configured) ─────────────────────── */

function StepPayment({
  planTier,
  companySlug,
  submitOrganization,
  onSuccess,
  onBack,
}: {
  planTier: "pro" | "white_label";
  companySlug: string;
  submitOrganization: (
    tier: OrgPlanTier,
  ) => Promise<{ orgId: string; requiresEmailConfirmation: boolean }>;
  onSuccess: (requiresEmailConfirmation: boolean, orgId: string) => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardFocused, setCardFocused] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = PLAN_CARDS.find((p) => p.tier === planTier);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;

    setPaying(true);
    setError(null);
    try {
      const pm = await stripe.createPaymentMethod({ type: "card", card });
      if (pm.error || !pm.paymentMethod) {
        throw new Error(pm.error?.message ?? "Card was declined.");
      }

      const created = await submitOrganization(planTier);

      const sub = await createStripeSubscription({
        orgId: created.orgId,
        planTier,
        paymentMethodId: pm.paymentMethod.id,
      });
      if (sub.error || !sub.subscriptionId) {
        throw new Error(sub.error ?? "We could not start your subscription.");
      }

      if (sub.clientSecret) {
        const confirmation = await stripe.confirmCardPayment(sub.clientSecret);
        if (confirmation.error) {
          throw new Error(
            confirmation.error.message ??
              "Your bank declined the payment. Try a different card.",
          );
        }
      }

      onSuccess(created.requiresEmailConfirmation, created.orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div>
      <div className={styles.orderSummary}>
        <div className={styles.orderRow}>
          <span>{plan?.name} plan, monthly</span>
          <span>${plan?.priceMonthly}/mo</span>
        </div>
        <div className={styles.orderRow}>
          <span>Workspace</span>
          <span>{companySlug}.myproxyhost.com</span>
        </div>
        <div className={styles.orderTotal}>
          <span>Due today</span>
          <span>${plan?.priceMonthly}.00</span>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="signup-card">
          Card details
        </label>
        <div
          id="signup-card"
          className={`${styles.cardBox} ${cardFocused ? styles.cardBoxFocus : ""}`}
        >
          <CardElement
            onFocus={() => setCardFocused(true)}
            onBlur={() => setCardFocused(false)}
            onChange={(e) => setCardComplete(e.complete)}
            options={{
              style: {
                base: {
                  fontSize: "15px",
                  color: "#1a1a1a",
                  fontFamily: "Geist, system-ui, sans-serif",
                  "::placeholder": { color: "#a8a29e" },
                },
                invalid: { color: "#dc2626" },
              },
            }}
          />
        </div>
        <p className={styles.secureNote}>
          <LockSimple size={13} weight="fill" />
          Encrypted and processed by Stripe. Card details never touch our servers.
        </p>
      </div>

      {error && (
        <div className={styles.alertError} role="alert">
          <WarningCircle size={17} weight="fill" />
          {error}
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.btnGhost} onClick={onBack} disabled={paying}>
          <ArrowLeft size={15} weight="bold" />
          Back
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => void handlePay()}
          disabled={paying || !cardComplete || !stripe}
        >
          {paying ? (
            <>
              <CircleNotch size={16} className={styles.spin} />
              Processing...
            </>
          ) : (
            <>
              Start subscription
              <ArrowRight size={16} weight="bold" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Step 4 fallback: billing not configured ─────────────────── */

function PaymentUnavailable({
  submitting,
  submitError,
  onStartFree,
  onBack,
}: {
  submitting: boolean;
  submitError: string | null;
  onStartFree: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className={styles.fallback}>
        <span className={styles.fallbackTitle}>
          <Sparkle size={18} weight="duotone" />
          Card payments are almost ready
        </span>
        <p className={styles.fallbackBody}>
          Self-serve checkout for paid plans is not live yet. Start on the free
          Starter plan today; your workspace, clients, and documents carry over
          the moment you upgrade from Settings.
        </p>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onStartFree}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <CircleNotch size={15} className={styles.spin} />
              Creating workspace...
            </>
          ) : (
            <>
              Start free on Starter
              <ArrowRight size={15} weight="bold" />
            </>
          )}
        </button>
      </div>

      {submitError && (
        <div className={styles.alertError} role="alert">
          <WarningCircle size={17} weight="fill" />
          {submitError}
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.btnGhost} onClick={onBack} disabled={submitting}>
          <ArrowLeft size={15} weight="bold" />
          Back
        </button>
        <span />
      </div>
    </div>
  );
}

/* ── Success ─────────────────────────────────────────────────── */

function SuccessPanel({ success }: { success: SignupSuccess }) {
  const planName =
    PLAN_CARDS.find((p) => p.tier === success.planTier)?.name ?? "Starter";

  return (
    <div className={styles.success}>
      <span className={styles.successIcon}>
        <CheckCircle size={34} weight="fill" />
      </span>
      <h2 className={styles.stepTitle}>Your workspace is ready</h2>
      <p className={styles.stepSub} style={{ marginBottom: 0 }}>
        You are on the {planName} plan. Your branded client portal lives at:
      </p>
      <span className={styles.successUrl}>
        <RocketLaunch size={16} weight="duotone" />
        {success.slug}.myproxyhost.com
      </span>

      {success.requiresEmailConfirmation && (
        <p className={styles.successNote}>
          <EnvelopeSimple size={17} weight="duotone" />
          We sent you a confirmation email. Click the link inside, then sign in
          to finish setting up your brand.
        </p>
      )}

      <div className={styles.actions} style={{ justifyContent: "center", width: "100%" }}>
        <Link
          href={success.requiresEmailConfirmation ? "/login" : "/admin/onboarding"}
          className={styles.btnPrimary}
        >
          {success.requiresEmailConfirmation ? "Go to login" : "Set up your workspace"}
          <ArrowRight size={16} weight="bold" />
        </Link>
      </div>
    </div>
  );
}
