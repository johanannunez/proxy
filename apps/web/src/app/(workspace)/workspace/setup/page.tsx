import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Circle,
  ClipboardText,
  House,
  PencilSimple,
  Sparkle,
  User,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { PropertySelector } from "@/components/workspace/PropertySelector";
import { OwnerLocalTime } from "@/components/workspace/OwnerLocalTime";
import {
  activeSetupSearchIndex as setupSearchIndex,
  groupStepsByGroup,
} from "@/lib/wizard/search-index";

export const metadata: Metadata = {
  title: "Setup",
};

export const dynamic = "force-dynamic";

type StepState = "done" | "active" | "todo";

type PropertyRow = {
  id: string;
  name: string | null;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  guest_capacity: number | null;
  active: boolean;
};

/**
 * Resolve step state for a property step.
 * propertyFormsDone: set of form_keys with completed_at in property_forms.
 */
function resolvePropertyStepState(
  stepKey: string,
  property: PropertyRow | null,
  allStepKeys: string[],
  propertyFormsDone: Set<string>,
): StepState {
  if (!property) return "todo";

  const completionChecks: Record<string, boolean> = {
    "agreement-preview": false,
    basics: Boolean(property.property_type && property.name !== undefined),
    address: Boolean(property.address_line1 && property.city && property.state),
    space:
      property.bedrooms !== null &&
      property.bathrooms !== null &&
      property.guest_capacity !== null,
    amenities: false,
    rules: false,
    wifi: false,
    financial: false,
    recommendations: false,
    cleaning: false,
    photos: false,
    compliance: false,
    "host-agreement": false,
    review: false,
    // property_forms-backed sections
    setup_basic: propertyFormsDone.has("setup_basic"),
    setup_access: propertyFormsDone.has("setup_access"),
    setup_security: propertyFormsDone.has("setup_security"),
    setup_utilities: propertyFormsDone.has("setup_utilities"),
    setup_appliances: propertyFormsDone.has("setup_appliances"),
    setup_contacts: propertyFormsDone.has("setup_contacts"),
    setup_tech: propertyFormsDone.has("setup_tech"),
    setup_house_rules: propertyFormsDone.has("setup_house_rules"),
    setup_amenities: propertyFormsDone.has("setup_amenities"),
    setup_listing: propertyFormsDone.has("setup_listing"),
    setup_communication: propertyFormsDone.has("setup_communication"),
    str_permit: propertyFormsDone.has("str_permit"),
    hoa_info: propertyFormsDone.has("hoa_info"),
    insurance_certificate: propertyFormsDone.has("insurance_certificate"),
    platform_authorization: propertyFormsDone.has("platform_authorization"),
  };

  const isDone = completionChecks[stepKey] ?? false;
  if (isDone) return "done";

  const firstIncompleteIdx = allStepKeys.findIndex(
    (k) => !(completionChecks[k] ?? false),
  );
  const myIdx = allStepKeys.indexOf(stepKey);

  if (myIdx === firstIncompleteIdx) return "active";
  return "todo";
}

function resolveOwnerStepState(
  stepKey: string,
  profile: { full_name: string | null },
  allStepKeys: string[],
): StepState {
  const completionChecks: Record<string, boolean> = {
    account: Boolean(profile.full_name),
    identity: false,
    w9: false,
    payout: false,
  };

  const isDone = completionChecks[stepKey] ?? false;
  if (isDone) return "done";

  const firstIncompleteIdx = allStepKeys.findIndex(
    (k) => !(completionChecks[k] ?? false),
  );
  const myIdx = allStepKeys.indexOf(stepKey);

  if (myIdx === firstIncompleteIdx) return "active";
  return "todo";
}

export default async function SetupHubPage({
  searchParams,
}: {
  searchParams?: Promise<{ just?: string; property?: string; gate?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const params = await searchParams;
  const justCompleted = params?.just ?? null;
  const selectedPropertyId = params?.property ?? null;
  const gateRedirect = params?.gate ?? null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, timezone, role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Admin sees all properties with owner names; owners see only their own
  const { data: properties } = isAdmin
    ? await supabase
        .from("properties")
        .select(
          "id, name, address_line1, city, state, postal_code, property_type, bedrooms, bathrooms, guest_capacity, active, owner_id, profiles!properties_owner_id_fkey(full_name)",
        )
        .order("created_at", { ascending: true })
    : await supabase
        .from("properties")
        .select(
          "id, name, address_line1, city, state, postal_code, property_type, bedrooms, bathrooms, guest_capacity, active",
        )
        .order("created_at", { ascending: true });

  const firstName =
    profile?.full_name?.split(" ")[0] ??
    user.email?.split("@")[0] ??
    "there";

  const selected =
    (selectedPropertyId
      ? (properties ?? []).find((p) => p.id === selectedPropertyId)
      : undefined) ??
    ((properties?.[0] as PropertyRow | undefined) ?? null);

  // Fetch property_forms completion for the selected property
  const propertyFormsDone = new Set<string>();
  if (selected?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: formRows } = await (supabase as any)
      .from("property_forms")
      .select("form_key, completed_at")
      .eq("property_id", selected.id);
    for (const row of (formRows ?? []) as { form_key: string; completed_at: string | null }[]) {
      if (row.completed_at) propertyFormsDone.add(row.form_key);
    }
  }

  const propertyGroups = groupStepsByGroup("property");
  const ownerGroups = groupStepsByGroup("owner");

  const propertyStepKeys = setupSearchIndex
    .filter((s) => s.track === "property")
    .map((s) => s.stepKey);
  const ownerStepKeys = setupSearchIndex
    .filter((s) => s.track === "owner")
    .map((s) => s.stepKey);

  const propertyStepStates = new Map<string, StepState>();
  for (const key of propertyStepKeys) {
    propertyStepStates.set(
      key,
      resolvePropertyStepState(
        key,
        selected as PropertyRow | null,
        propertyStepKeys,
        propertyFormsDone,
      ),
    );
  }

  const ownerStepStates = new Map<string, StepState>();
  for (const key of ownerStepKeys) {
    ownerStepStates.set(
      key,
      resolveOwnerStepState(
        key,
        { full_name: profile?.full_name ?? null },
        ownerStepKeys,
      ),
    );
  }

  const propertyDone = [...propertyStepStates.values()].filter(
    (s) => s === "done",
  ).length;
  const propertyTotal = propertyStepStates.size;
  const ownerDone = [...ownerStepStates.values()].filter(
    (s) => s === "done",
  ).length;
  const ownerTotal = ownerStepStates.size;
  const totalDone = propertyDone + ownerDone;
  const totalSteps = propertyTotal + ownerTotal;
  const overallPct =
    totalSteps > 0 ? Math.round((totalDone / totalSteps) * 100) : 0;

  const nextPropertyStep = setupSearchIndex
    .filter((s) => s.track === "property")
    .find((s) => {
      const state = propertyStepStates.get(s.stepKey);
      return state === "active" || state === "todo";
    });

  const nextOwnerStep = setupSearchIndex
    .filter((s) => s.track === "owner")
    .find((s) => {
      const state = ownerStepStates.get(s.stepKey);
      return state === "active" || state === "todo";
    });

  return (
    <div className="-mx-6 -my-10 flex h-[calc(100vh-var(--topbar-h,0px))] flex-col lg:-mx-10 lg:-my-14">
      {gateRedirect === "account" ? (
        <div
          role="alert"
          className="mx-6 mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm lg:mx-10"
          style={{
            borderColor: "#fcd6a4",
            backgroundColor: "#fffbf0",
            color: "#92400e",
          }}
        >
          <span className="font-semibold">Complete your account details first.</span>
          {" "}Fill in your name, phone, and mailing address before starting property setup.
        </div>
      ) : justCompleted ? (
        <div
          role="status"
          className="mx-6 mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm lg:mx-10"
          style={{
            borderColor: "#bfe5cd",
            backgroundColor: "#f2fbf5",
            color: "#166534",
          }}
        >
          <CheckCircle
            size={18}
            weight="fill"
            style={{ color: "#15803d" }}
          />
          <span>
            <span className="font-semibold">Step saved.</span> Keep going or
            come back anytime.
          </span>
        </div>
      ) : null}

      <header className="flex flex-col gap-2 px-6 pt-8 lg:px-10">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Onboarding
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1
              className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]"
              style={{ color: "var(--color-text-primary)" }}
            >
              Let us get you set up, {firstName}.
            </h1>
            <OwnerLocalTime timezone={profile?.timezone ?? null} />
          </div>
          <div className="flex items-center gap-3">
            <div
              className="h-2 w-24 overflow-hidden rounded-full sm:w-32"
              style={{ backgroundColor: "var(--color-warm-gray-100)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${overallPct}%`,
                  background:
                    "linear-gradient(90deg, #02aaeb 0%, #1b77be 100%)",
                }}
              />
            </div>
            <span
              className="whitespace-nowrap text-sm font-medium tabular-nums"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {totalDone} of {totalSteps}
              <span
                className="ml-1.5 text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {overallPct}%
              </span>
            </span>
          </div>
        </div>

        {selected && properties && (
          <div className="mt-3">
            <PropertySelector
              properties={(properties as (PropertyRow & { profiles?: { full_name: string | null } | null })[]).map((p) => ({
                id: p.id,
                name: null,
                address_line1: p.address_line1,
                city: p.city,
                state: p.state,
                ownerName: isAdmin && "profiles" in p ? (p as { profiles?: { full_name: string | null } | null }).profiles?.full_name ?? null : null,
              }))}
              activeId={selected.id}
              hrefTemplate="/workspace/setup?property={id}"
              variant="inline"
              showOwner={isAdmin}
            />
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/workspace/setup/welcome"
            className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:opacity-95"
            style={{
              borderColor: "#02aaeb30",
              backgroundColor: "rgba(2, 170, 235, 0.06)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "linear-gradient(135deg, #02aaeb, #1b77be)",
                }}
              >
                <Sparkle size={14} weight="fill" className="text-white" />
              </span>
              <div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: "#1b77be" }}
                >
                  Welcome
                </span>
                <span
                  className="ml-2 text-sm"
                  style={{ color: "#1b77beaa" }}
                >
                  Meet the team and schedule your kickoff call.
                </span>
              </div>
            </div>
            <ArrowRight
              size={14}
              weight="bold"
              style={{ color: "#1b77be80" }}
            />
          </Link>

          <Link
            href="/workspace/home"
            className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:opacity-95"
            style={{
              borderColor: "#e8850030",
              backgroundColor: "rgba(232, 133, 0, 0.06)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "linear-gradient(135deg, #e88500, #c06a00)",
                }}
              >
                <ClipboardText size={14} weight="duotone" className="text-white" />
              </span>
              <div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: "#b05e00" }}
                >
                  Stuck?
                </span>
                <span
                  className="ml-2 text-sm"
                  style={{ color: "#b05e00aa" }}
                >
                  Message Proxy and we will jump in.
                </span>
              </div>
            </div>
            <ArrowRight
              size={14}
              weight="bold"
              style={{ color: "#b05e0080" }}
            />
          </Link>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col gap-6 px-6 pb-4 pt-6 lg:flex-row lg:px-10">
        <TrackCard
          eyebrow="Track 01"
          title="Property setup"
          icon={<House size={20} weight="duotone" />}
          tintHex="#1b77be"
          done={propertyDone}
          total={propertyTotal}
          groups={propertyGroups}
          stepStates={propertyStepStates}
          nextStep={nextPropertyStep}
          propertyId={selected?.id}
        />
        <TrackCard
          eyebrow="Track 02"
          title="Owner essentials"
          icon={<User size={20} weight="duotone" />}
          tintHex="#1b77be"
          done={ownerDone}
          total={ownerTotal}
          groups={ownerGroups}
          stepStates={ownerStepStates}
          nextStep={nextOwnerStep}
        />
      </section>

    </div>
  );
}

type TrackGroup = {
  group: string;
  steps: {
    stepKey: string;
    label: string;
    href: string;
    estimateMinutes: number;
  }[];
};

function TrackCard({
  eyebrow,
  title,
  icon,
  tintHex,
  done,
  total,
  groups,
  stepStates,
  nextStep,
  propertyId,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  tintHex: string;
  done: number;
  total: number;
  groups: TrackGroup[];
  stepStates: Map<string, StepState>;
  nextStep?: { stepKey: string; label: string; href: string } | null;
  propertyId?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function buildHref(href: string) {
    if (propertyId) return `${href}?property=${propertyId}`;
    return href;
  }

  return (
    <article
      className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--color-warm-gray-200)",
        backgroundColor: "var(--color-white)",
      }}
    >
      <header className="flex items-start justify-between gap-4 px-5 pt-5">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${tintHex}14`,
              color: tintHex,
            }}
          >
            {icon}
          </span>
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {eyebrow}
            </p>
            <h2
              className="text-lg font-semibold tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              {title}
            </h2>
          </div>
        </div>
        <div
          className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-secondary)",
          }}
        >
          {done}/{total}
        </div>
      </header>

      <div className="px-5 pt-3">
        <div
          className="h-1 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--color-warm-gray-100)" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, backgroundColor: tintHex }}
          />
        </div>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-3 pb-3">
        {groups.map((g) => (
          <div key={g.group}>
            <p
              className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {g.group}
            </p>
            <ul>
              {g.steps.map((step, idx) => {
                const state = stepStates.get(step.stepKey) ?? "todo";
                const globalIdx =
                  groups
                    .slice(0, groups.indexOf(g))
                    .reduce((sum, gg) => sum + gg.steps.length, 0) +
                  idx +
                  1;
                return (
                  <li key={step.stepKey}>
                    <StepRow
                      label={step.label}
                      state={state}
                      index={globalIdx}
                      tint={tintHex}
                      href={buildHref(step.href)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <footer
        className="mt-auto flex items-center justify-between gap-4 border-t px-5 py-3.5"
        style={{ borderColor: "var(--color-warm-gray-200)" }}
      >
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Next up
          </p>
          <p
            className="mt-0.5 truncate text-sm font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            {nextStep?.label ?? "All done"}
          </p>
        </div>
        {nextStep ? (
          <Link
            href={buildHref(nextStep.href)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: tintHex }}
          >
            Continue
            <ArrowRight size={14} weight="bold" />
          </Link>
        ) : (
          <span
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              color: "var(--color-text-tertiary)",
              backgroundColor: "var(--color-warm-gray-50)",
            }}
          >
            Complete
          </span>
        )}
      </footer>
    </article>
  );
}

function StepRow({
  label,
  state,
  index,
  tint,
  href,
}: {
  label: string;
  state: StepState;
  index: number;
  tint: string;
  href: string;
}) {
  const isDone = state === "done";
  const isActive = state === "active";

  const icon = isDone ? (
    <CheckCircle size={17} weight="fill" />
  ) : (
    <Circle size={15} weight={isActive ? "bold" : "regular"} />
  );

  const iconColor = isDone || isActive ? tint : "var(--color-text-tertiary)";
  const labelColor =
    state === "todo" ? "var(--color-text-secondary)" : "var(--color-text-primary)";

  return (
    <Link
      href={href}
      className="block rounded-lg transition-colors hover:bg-[var(--color-warm-gray-50)]"
    >
      <div
        className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
        style={{
          backgroundColor: isActive
            ? "var(--color-warm-gray-50)"
            : "transparent",
        }}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center"
          style={{ color: iconColor }}
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="text-[10px] font-semibold tabular-nums tracking-[0.12em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {String(index).padStart(2, "0")}
          </span>
          <span
            className="truncate text-sm font-medium"
            style={{
              color: labelColor,
              textDecoration: isDone ? "line-through" : "none",
              textDecorationColor: "var(--color-warm-gray-200)",
            }}
          >
            {label}
          </span>
        </div>
        {isDone && (
          <span
            className="shrink-0"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <PencilSimple size={13} weight="duotone" />
          </span>
        )}
      </div>
    </Link>
  );
}
