"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  FloppyDisk,
  Sparkle,
  UserCircle,
  House,
  MapPin,
  Ruler,
  ClipboardText,
  ShieldCheck,
  Users as UsersIcon,
} from "@phosphor-icons/react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { addProperty, type AddPropertyState } from "./actions";
import {
  EMPTY_WIZARD,
  SECTIONS,
  STORAGE_KEY,
  type SectionKey,
  type WizardData,
} from "./wizard-types";
import {
  ChoicePill,
  CheckboxCard,
  Field,
  SectionHeader,
  Select,
  Textarea,
  TextInput,
} from "./wizard-ui";

const initial: AddPropertyState = {};

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
  "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const ICONS: Record<string, React.ComponentType<{ size?: number; weight?: "duotone" | "regular" | "bold" }>> = {
  Sparkle,
  UserCircle,
  House,
  MapPin,
  Ruler,
  ClipboardText,
  ShieldCheck,
  Users: UsersIcon,
  CheckCircle,
};

export function AddPropertyWizard() {
  const [state, formAction, pending] = useActionState(addProperty, initial);
  const [data, setData] = useState<WizardData>(EMPTY_WIZARD);
  const [currentKey, setCurrentKey] = useState<SectionKey>("welcome");
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WizardData>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData((prev) => deepMerge(prev, parsed));
      }
    } catch {
      // ignore corrupted draft
    }
    setHydrated(true);
  }, []);

  // Persist on every change once hydrated.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedAt(Date.now());
    } catch {
      // quota exceeded — ignore
    }
  }, [data, hydrated]);

  // Focus the section when navigating.
  useEffect(() => {
    stepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const focusable = stepRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button[type="button"]:not([disabled])',
    );
    focusable?.focus({ preventScroll: true });
  }, [currentKey]);

  const update = useCallback(
    <K extends keyof WizardData>(section: K, patch: Partial<WizardData[K]>) => {
      setData((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
    },
    [],
  );

  const currentIndex = SECTIONS.findIndex((s) => s.key === currentKey);
  const isLast = currentKey === "review";

  const goTo = (key: SectionKey) => setCurrentKey(key);
  const next = () => {
    const nextSection = SECTIONS[currentIndex + 1];
    if (nextSection) setCurrentKey(nextSection.key);
  };
  const back = () => {
    const prevSection = SECTIONS[currentIndex - 1];
    if (prevSection) setCurrentKey(prevSection.key);
  };

  // Validation: minimal — we only block on hard requirements per section.
  const canAdvance = useMemo(() => {
    switch (currentKey) {
      case "welcome":
        return true;
      case "owner":
        return !!data.owner.fullName.trim();
      case "identity":
        return !!data.identity.propertyType;
      case "address":
        return (
          !!data.address.line1.trim() &&
          !!data.address.city.trim() &&
          !!data.address.state.trim() &&
          !!data.address.postalCode.trim()
        );
      case "specs":
      case "amenities":
      case "rules":
      case "compliance":
      case "notes":
        return true;
      case "review":
        return true;
      default:
        return true;
    }
  }, [currentKey, data]);

  const clearDraft = () => {
    if (typeof window === "undefined") return;
    setShowClearConfirm(true);
  };

  const doClearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    setData(EMPTY_WIZARD);
    setCurrentKey("welcome");
  };

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]">
      {/* Stepper sidebar */}
      <aside className="lg:sticky lg:top-10 lg:h-fit">
        <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {SECTIONS.map((s, i) => {
            const Icon = ICONS[s.icon];
            const active = s.key === currentKey;
            const done = i < currentIndex;
            return (
              <li key={s.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(s.key)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors lg:w-auto"
                  style={{
                    color: active
                      ? "var(--color-text-primary)"
                      : "var(--color-text-secondary)",
                    backgroundColor: active
                      ? "var(--color-warm-gray-100)"
                      : "transparent",
                  }}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{
                      backgroundColor: done
                        ? "var(--color-brand)"
                        : active
                          ? "var(--color-brand)"
                          : "var(--color-warm-gray-100)",
                      color:
                        done || active
                          ? "var(--color-white)"
                          : "var(--color-text-secondary)",
                    }}
                  >
                    {Icon ? <Icon size={14} weight="duotone" /> : i + 1}
                  </span>
                  <span className="hidden lg:inline">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div
          className="mt-6 hidden rounded-xl border p-4 text-xs lg:block"
          style={{
            backgroundColor: "var(--color-warm-gray-50)",
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-secondary)",
          }}
        >
          <div className="flex items-center gap-2 font-semibold" style={{ color: "var(--color-text-primary)" }}>
            <FloppyDisk size={14} weight="duotone" aria-hidden="true" />
            Draft saved
          </div>
          <p className="mt-1">
            Your progress is saved on this device. Close the tab and come back
            any time.
          </p>
          <button
            type="button"
            onClick={clearDraft}
            className="mt-3 text-[11px] font-semibold underline-offset-2 hover:underline"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Clear and start over
          </button>
        </div>
      </aside>

      {/* Section content */}
      <form action={formAction} className="flex flex-col gap-8">
        {/* Hidden fields the action uses for the actual insert */}
        <input type="hidden" name="name" value={data.identity.nickname} />
        <input
          type="hidden"
          name="property_type"
          value={data.identity.propertyType}
        />
        <input
          type="hidden"
          name="address_line1"
          value={data.address.line1}
        />
        <input
          type="hidden"
          name="address_line2"
          value={data.address.line2}
        />
        <input type="hidden" name="city" value={data.address.city} />
        <input type="hidden" name="state" value={data.address.state} />
        <input
          type="hidden"
          name="postal_code"
          value={data.address.postalCode}
        />
        <input type="hidden" name="bedrooms" value={data.specs.bedrooms} />
        <input type="hidden" name="bathrooms" value={data.specs.bathrooms} />
        <input
          type="hidden"
          name="guest_capacity"
          value={data.specs.guestCapacity}
        />
        <input
          type="hidden"
          name="square_feet"
          value={data.specs.squareFeet}
        />

        <div
          ref={stepRef}
          className="rounded-2xl border p-6 sm:p-8"
          style={{
            backgroundColor: "var(--color-white)",
            borderColor: "var(--color-warm-gray-200)",
          }}
        >
          {currentKey === "welcome" ? <WelcomeStep onStart={next} /> : null}

          {currentKey === "owner" ? (
            <div className="flex flex-col gap-7">
              <SectionHeader
                eyebrow="Step 1 of 9"
                title="Tell us about you"
                body="The basics so we know who to reach when something needs your attention."
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Legal full name" required>
                  <TextInput
                    value={data.owner.fullName}
                    onChange={(v) => update("owner", { fullName: v })}
                    autoComplete="name"
                  />
                </Field>
                <Field label="Preferred name">
                  <TextInput
                    value={data.owner.preferredName}
                    onChange={(v) => update("owner", { preferredName: v })}
                    placeholder="What we call you"
                    autoComplete="nickname"
                  />
                </Field>
                <Field label="Phone" hint="Used for urgent property issues only.">
                  <TextInput
                    value={data.owner.phone}
                    onChange={(v) => update("owner", { phone: v })}
                    type="tel"
                    autoComplete="tel"
                    placeholder="(555) 123-4567"
                  />
                </Field>
                <Field label="Best way to reach you">
                  <Select
                    value={data.owner.contactMethod}
                    onChange={(v) =>
                      update("owner", {
                        contactMethod: v as WizardData["owner"]["contactMethod"],
                      })
                    }
                    options={[
                      { value: "email", label: "Email" },
                      { value: "sms", label: "Text message" },
                      { value: "phone", label: "Phone call" },
                      { value: "whatsapp", label: "WhatsApp" },
                    ]}
                  />
                </Field>
                <Field label="How did you hear about Proxy?">
                  <Select
                    value={data.owner.referralSource}
                    onChange={(v) => update("owner", { referralSource: v })}
                    options={[
                      { value: "friend", label: "Friend or family" },
                      { value: "google", label: "Google search" },
                      { value: "social", label: "Social media" },
                      { value: "podcast", label: "Podcast" },
                      { value: "agent", label: "Real estate agent" },
                      { value: "other", label: "Somewhere else" },
                    ]}
                  />
                </Field>
                <Field label="Years investing in real estate">
                  <Select
                    value={data.owner.yearsInvesting}
                    onChange={(v) => update("owner", { yearsInvesting: v })}
                    options={[
                      { value: "0", label: "First time" },
                      { value: "1-2", label: "1 to 2 years" },
                      { value: "3-5", label: "3 to 5 years" },
                      { value: "6-10", label: "6 to 10 years" },
                      { value: "10+", label: "10+ years" },
                    ]}
                  />
                </Field>
                <Field label="How many properties do you own?">
                  <Select
                    value={data.owner.propertyCount}
                    onChange={(v) => update("owner", { propertyCount: v })}
                    options={[
                      { value: "1", label: "Just this one" },
                      { value: "2-3", label: "2 to 3" },
                      { value: "4-9", label: "4 to 9" },
                      { value: "10+", label: "10 or more" },
                    ]}
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {currentKey === "identity" ? (
            <div className="flex flex-col gap-7">
              <SectionHeader
                eyebrow="Step 2 of 9"
                title="What kind of property?"
                body="Pick the category that best matches how you plan to use this home. You can change it later."
              />
              <Field label="Property nickname" hint="What you call it (optional).">
                <TextInput
                  value={data.identity.nickname}
                  onChange={(v) => update("identity", { nickname: v })}
                  placeholder="Cedar Ridge Retreat"
                />
              </Field>
              <Field label="Rental category" required>
                <ChoicePill
                  value={data.identity.propertyType}
                  onChange={(v) =>
                    update("identity", {
                      propertyType: v as WizardData["identity"]["propertyType"],
                    })
                  }
                  options={[
                    { value: "str", label: "Short term", hint: "Nightly stays" },
                    { value: "mtr", label: "Mid term", hint: "30+ day stays" },
                    { value: "ltr", label: "Long term", hint: "Annual lease" },
                    { value: "arbitrage", label: "Arbitrage", hint: "Leased + re-rented" },
                    { value: "co-hosting", label: "Co-hosting", hint: "We manage for you" },
                  ]}
                />
              </Field>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Property style">
                  <Select
                    value={data.identity.propertySubtype}
                    onChange={(v) =>
                      update("identity", { propertySubtype: v })
                    }
                    options={[
                      { value: "single_family", label: "Single family home" },
                      { value: "townhouse", label: "Townhouse" },
                      { value: "condo", label: "Condo" },
                      { value: "apartment", label: "Apartment" },
                      { value: "cabin", label: "Cabin" },
                      { value: "tinyhouse", label: "Tiny house" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </Field>
                <Field label="Year built">
                  <TextInput
                    value={data.identity.yearBuilt}
                    onChange={(v) => update("identity", { yearBuilt: v })}
                    type="number"
                    placeholder="1998"
                  />
                </Field>
                <Field label="Year you bought it">
                  <TextInput
                    value={data.identity.yearPurchased}
                    onChange={(v) =>
                      update("identity", { yearPurchased: v })
                    }
                    type="number"
                  />
                </Field>
                <Field label="Currently rented to a tenant?">
                  <Select
                    value={data.identity.currentlyRented}
                    onChange={(v) =>
                      update("identity", {
                        currentlyRented:
                          v as WizardData["identity"]["currentlyRented"],
                      })
                    }
                    options={[
                      { value: "no", label: "No, vacant" },
                      { value: "yes", label: "Yes, occupied" },
                    ]}
                  />
                </Field>
                <Field label="Listed on other booking sites?">
                  <Select
                    value={data.identity.listedElsewhere}
                    onChange={(v) =>
                      update("identity", {
                        listedElsewhere:
                          v as WizardData["identity"]["listedElsewhere"],
                      })
                    }
                    options={[
                      { value: "no", label: "Not yet" },
                      { value: "yes", label: "Yes, on Airbnb / Vrbo / etc." },
                    ]}
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {currentKey === "address" ? (
            <div className="flex flex-col gap-7">
              <SectionHeader
                eyebrow="Step 3 of 9"
                title="Where is it located?"
                body="The address helps us calculate taxes, match local regulations, and generate accurate listings."
              />
              <Field label="Street address" required>
                <TextInput
                  value={data.address.line1}
                  onChange={(v) => update("address", { line1: v })}
                  autoComplete="address-line1"
                  placeholder="34 Downing Drive"
                />
              </Field>
              <Field label="Apartment, suite, etc.">
                <TextInput
                  value={data.address.line2}
                  onChange={(v) => update("address", { line2: v })}
                  autoComplete="address-line2"
                />
              </Field>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <Field label="City" required>
                  <TextInput
                    value={data.address.city}
                    onChange={(v) => update("address", { city: v })}
                    autoComplete="address-level2"
                  />
                </Field>
                <Field label="State" required>
                  <Select
                    value={data.address.state}
                    onChange={(v) => update("address", { state: v })}
                    options={STATES.map((s) => ({ value: s, label: s }))}
                  />
                </Field>
                <Field label="Postal code" required>
                  <TextInput
                    value={data.address.postalCode}
                    onChange={(v) => update("address", { postalCode: v })}
                    autoComplete="postal-code"
                  />
                </Field>
              </div>
              <Field
                label="Neighborhood"
                hint="Helps us write a more compelling listing."
              >
                <TextInput
                  value={data.address.neighborhood}
                  onChange={(v) => update("address", { neighborhood: v })}
                />
              </Field>
            </div>
          ) : null}

          {currentKey === "specs" ? (
            <div className="flex flex-col gap-7">
              <SectionHeader
                eyebrow="Step 4 of 9"
                title="The space"
                body="Approximate counts are fine. You can always refine these later from the property page."
              />
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                <Field label="Bedrooms">
                  <TextInput
                    value={data.specs.bedrooms}
                    onChange={(v) => update("specs", { bedrooms: v })}
                    type="number"
                  />
                </Field>
                <Field label="Bathrooms">
                  <TextInput
                    value={data.specs.bathrooms}
                    onChange={(v) => update("specs", { bathrooms: v })}
                    type="number"
                  />
                </Field>
                <Field label="Half baths">
                  <TextInput
                    value={data.specs.halfBaths}
                    onChange={(v) => update("specs", { halfBaths: v })}
                    type="number"
                  />
                </Field>
                <Field label="Sleeps">
                  <TextInput
                    value={data.specs.guestCapacity}
                    onChange={(v) =>
                      update("specs", { guestCapacity: v })
                    }
                    type="number"
                  />
                </Field>
                <Field label="Square feet">
                  <TextInput
                    value={data.specs.squareFeet}
                    onChange={(v) => update("specs", { squareFeet: v })}
                    type="number"
                  />
                </Field>
                <Field label="Stories">
                  <TextInput
                    value={data.specs.yearStories}
                    onChange={(v) => update("specs", { yearStories: v })}
                    type="number"
                  />
                </Field>
                <Field label="Parking spaces">
                  <TextInput
                    value={data.specs.parkingSpaces}
                    onChange={(v) =>
                      update("specs", { parkingSpaces: v })
                    }
                    type="number"
                  />
                </Field>
                <Field label="Parking type">
                  <Select
                    value={data.specs.parkingType}
                    onChange={(v) =>
                      update("specs", {
                        parkingType:
                          v as WizardData["specs"]["parkingType"],
                      })
                    }
                    options={[
                      { value: "garage", label: "Garage" },
                      { value: "driveway", label: "Driveway" },
                      { value: "street", label: "Street" },
                      { value: "lot", label: "Lot" },
                      { value: "none", label: "None" },
                    ]}
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {currentKey === "amenities" ? (
            <div className="flex flex-col gap-7">
              <SectionHeader
                eyebrow="Step 5 of 9"
                title="Amenities"
                body="Tap everything the home has. We use this to set up listings and answer guest questions automatically."
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["wifi", "Wi-Fi", "Required for short term"],
                    ["ac", "Air conditioning"],
                    ["heating", "Heating"],
                    ["washerDryer", "Washer + dryer"],
                    ["dishwasher", "Dishwasher"],
                    ["pool", "Swimming pool"],
                    ["hotTub", "Hot tub"],
                    ["grill", "Outdoor grill"],
                    ["fencedYard", "Fenced yard"],
                    ["smartLock", "Smart lock"],
                    ["evCharger", "EV charger"],
                    ["workspace", "Dedicated workspace"],
                  ] as const
                ).map(([key, label, hint]) => (
                  <CheckboxCard
                    key={key}
                    label={label}
                    hint={hint}
                    checked={data.amenities[key]}
                    onChange={(v) => update("amenities", { [key]: v })}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {currentKey === "rules" ? (
            <div className="flex flex-col gap-7">
              <SectionHeader
                eyebrow="Step 6 of 9"
                title="House rules"
                body="The defaults below work for most homes. We will fine-tune these together once we list."
              />
              <div className="grid grid-cols-2 gap-5">
                <Field label="Check-in time">
                  <TextInput
                    value={data.rules.checkInTime}
                    onChange={(v) =>
                      update("rules", { checkInTime: v })
                    }
                    placeholder="3:00 PM"
                  />
                </Field>
                <Field label="Check-out time">
                  <TextInput
                    value={data.rules.checkOutTime}
                    onChange={(v) =>
                      update("rules", { checkOutTime: v })
                    }
                    placeholder="11:00 AM"
                  />
                </Field>
                <Field label="Minimum nights">
                  <TextInput
                    value={data.rules.minNights}
                    onChange={(v) => update("rules", { minNights: v })}
                    type="number"
                    placeholder="2"
                  />
                </Field>
                <Field label="Maximum nights">
                  <TextInput
                    value={data.rules.maxNights}
                    onChange={(v) => update("rules", { maxNights: v })}
                    type="number"
                    placeholder="30"
                  />
                </Field>
                <Field label="Pets allowed?">
                  <Select
                    value={data.rules.petsAllowed}
                    onChange={(v) =>
                      update("rules", {
                        petsAllowed:
                          v as WizardData["rules"]["petsAllowed"],
                      })
                    }
                    options={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                    ]}
                  />
                </Field>
                <Field label="Smoking?">
                  <Select
                    value={data.rules.smokingAllowed}
                    onChange={(v) =>
                      update("rules", {
                        smokingAllowed:
                          v as WizardData["rules"]["smokingAllowed"],
                      })
                    }
                    options={[
                      { value: "no", label: "Not allowed" },
                      { value: "outdoor", label: "Outdoor only" },
                      { value: "designated", label: "Designated area" },
                    ]}
                  />
                </Field>
                <Field label="Events allowed?">
                  <Select
                    value={data.rules.eventsAllowed}
                    onChange={(v) =>
                      update("rules", {
                        eventsAllowed:
                          v as WizardData["rules"]["eventsAllowed"],
                      })
                    }
                    options={[
                      { value: "no", label: "No" },
                      { value: "yes", label: "Yes, with approval" },
                    ]}
                  />
                </Field>
                <Field label="Children welcome?">
                  <Select
                    value={data.rules.childrenWelcome}
                    onChange={(v) =>
                      update("rules", {
                        childrenWelcome:
                          v as WizardData["rules"]["childrenWelcome"],
                      })
                    }
                    options={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "Adults only" },
                    ]}
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {currentKey === "compliance" ? (
            <div className="flex flex-col gap-7">
              <SectionHeader
                eyebrow="Step 7 of 9"
                title="Compliance + insurance"
                body="The legal stuff. If you do not have these yet, leave them blank and we will help you sort it out."
              />
              <Field label="Does your area require a short-term rental permit?">
                <Select
                  value={data.compliance.permitRequired}
                  onChange={(v) =>
                    update("compliance", {
                      permitRequired:
                        v as WizardData["compliance"]["permitRequired"],
                    })
                  }
                  options={[
                    { value: "yes", label: "Yes, I have one" },
                    { value: "no", label: "No, not required" },
                    { value: "unsure", label: "Not sure, please check" },
                  ]}
                />
              </Field>
              {data.compliance.permitRequired === "yes" ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="Permit number">
                    <TextInput
                      value={data.compliance.permitNumber}
                      onChange={(v) =>
                        update("compliance", { permitNumber: v })
                      }
                    />
                  </Field>
                  <Field label="Permit expires">
                    <TextInput
                      value={data.compliance.permitExpires}
                      onChange={(v) =>
                        update("compliance", { permitExpires: v })
                      }
                      type="date"
                    />
                  </Field>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Insurance carrier">
                  <TextInput
                    value={data.compliance.insuranceCarrier}
                    onChange={(v) =>
                      update("compliance", { insuranceCarrier: v })
                    }
                    placeholder="Proper / Allstate / etc."
                  />
                </Field>
                <Field label="Policy number">
                  <TextInput
                    value={data.compliance.insurancePolicyNumber}
                    onChange={(v) =>
                      update("compliance", { insurancePolicyNumber: v })
                    }
                  />
                </Field>
                <Field label="Insurance expires">
                  <TextInput
                    value={data.compliance.insuranceExpires}
                    onChange={(v) =>
                      update("compliance", { insuranceExpires: v })
                    }
                    type="date"
                  />
                </Field>
              </div>
              <Field label="Is the property in an HOA?">
                <Select
                  value={data.compliance.hoaExists}
                  onChange={(v) =>
                    update("compliance", {
                      hoaExists: v as WizardData["compliance"]["hoaExists"],
                    })
                  }
                  options={[
                    { value: "no", label: "No HOA" },
                    { value: "yes", label: "Yes, there is an HOA" },
                  ]}
                />
              </Field>
              {data.compliance.hoaExists === "yes" ? (
                <Field label="Does the HOA allow short-term rentals?">
                  <Select
                    value={data.compliance.hoaAllowsStr}
                    onChange={(v) =>
                      update("compliance", {
                        hoaAllowsStr:
                          v as WizardData["compliance"]["hoaAllowsStr"],
                      })
                    }
                    options={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                      { value: "unsure", label: "Not sure" },
                    ]}
                  />
                </Field>
              ) : null}
            </div>
          ) : null}

          {currentKey === "notes" ? (
            <div className="flex flex-col gap-7">
              <SectionHeader
                eyebrow="Step 8 of 9"
                title="Your team"
                body="People we may coordinate with. All optional. Leave blank if you would like Proxy to bring in our trusted vendors."
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Cleaner name">
                  <TextInput
                    value={data.notes.cleanerName}
                    onChange={(v) => update("notes", { cleanerName: v })}
                  />
                </Field>
                <Field label="Cleaner phone">
                  <TextInput
                    value={data.notes.cleanerPhone}
                    onChange={(v) => update("notes", { cleanerPhone: v })}
                    type="tel"
                  />
                </Field>
                <Field label="Handyman name">
                  <TextInput
                    value={data.notes.handymanName}
                    onChange={(v) => update("notes", { handymanName: v })}
                  />
                </Field>
                <Field label="Handyman phone">
                  <TextInput
                    value={data.notes.handymanPhone}
                    onChange={(v) => update("notes", { handymanPhone: v })}
                    type="tel"
                  />
                </Field>
              </div>
              <Field
                label="Anything else we should know?"
                hint="Quirks of the home, access codes, special requests, etc."
              >
                <Textarea
                  value={data.notes.teamNotes}
                  onChange={(v) => update("notes", { teamNotes: v })}
                  placeholder="The fridge water filter needs replacing every June. The neighbor on the left is friendly but the one on the right is not."
                  rows={5}
                />
              </Field>
            </div>
          ) : null}

          {currentKey === "review" ? (
            <ReviewStep data={data} onJump={goTo} />
          ) : null}
        </div>

        {state.error ? (
          <p
            className="text-sm"
            style={{ color: "var(--color-error)" }}
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={back}
            disabled={currentIndex === 0 || pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <ArrowLeft size={14} weight="bold" />
            Back
          </button>

          <div
            className="hidden text-[11px] sm:block"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {savedAt ? "Draft saved automatically" : null}
          </div>

          {!isLast ? (
            <button
              type="button"
              onClick={next}
              disabled={!canAdvance}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              Continue
              <ArrowRight size={14} weight="bold" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              {pending ? "Adding property..." : "Submit and add property"}
              <CheckCircle size={14} weight="bold" />
            </button>
          )}
        </div>
      </form>

      <ConfirmModal
        open={showClearConfirm}
        title="Clear your progress?"
        description="All information you have entered will be lost. This cannot be undone."
        confirmLabel="Clear everything"
        variant="danger"
        onConfirm={() => { setShowClearConfirm(false); doClearDraft(); }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-start gap-6">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: "rgba(2, 170, 235, 0.10)",
          color: "#0c6fae",
        }}
      >
        <Sparkle size={26} weight="duotone" />
      </span>
      <div>
        <h2
          className="text-[28px] font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Welcome. Let us learn about your home.
        </h2>
        <p
          className="mt-3 max-w-xl text-base"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Eight short sections, about ten minutes total. Your progress is
          saved on this device after every keystroke. You can close the tab
          and come back any time.
        </p>
      </div>
      <ul
        className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {[
          "About you and how to reach you",
          "What kind of property and where",
          "The space and amenities",
          "House rules and policies",
          "Insurance and permits",
          "Your trusted vendors",
        ].map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 rounded-xl border p-3 text-sm"
            style={{
              backgroundColor: "var(--color-warm-gray-50)",
              borderColor: "var(--color-warm-gray-200)",
            }}
          >
            <CheckCircle
              size={16}
              weight="duotone"
              style={{ color: "var(--color-brand)" }}
              aria-hidden="true"
            />
            {b}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onStart}
        className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--color-brand)" }}
      >
        Begin
        <ArrowRight size={14} weight="bold" />
      </button>
    </div>
  );
}

function ReviewStep({
  data,
  onJump,
}: {
  data: WizardData;
  onJump: (k: SectionKey) => void;
}) {
  const groups: { key: SectionKey; label: string; rows: [string, string][] }[] = [
    {
      key: "owner",
      label: "About you",
      rows: [
        ["Legal name", data.owner.fullName || "—"],
        ["Phone", data.owner.phone || "—"],
        ["Best contact", data.owner.contactMethod || "—"],
      ],
    },
    {
      key: "identity",
      label: "Property type",
      rows: [
        ["Nickname", data.identity.nickname || "—"],
        ["Category", data.identity.propertyType || "—"],
        ["Style", data.identity.propertySubtype || "—"],
        ["Year built", data.identity.yearBuilt || "—"],
      ],
    },
    {
      key: "address",
      label: "Address",
      rows: [
        [
          "Street",
          [data.address.line1, data.address.line2].filter(Boolean).join(", ") ||
            "—",
        ],
        [
          "City / State / ZIP",
          `${data.address.city || "—"}, ${data.address.state || "—"} ${data.address.postalCode || ""}`,
        ],
      ],
    },
    {
      key: "specs",
      label: "The space",
      rows: [
        ["Bedrooms", data.specs.bedrooms || "—"],
        ["Bathrooms", data.specs.bathrooms || "—"],
        ["Sleeps", data.specs.guestCapacity || "—"],
        ["Square feet", data.specs.squareFeet || "—"],
      ],
    },
    {
      key: "rules",
      label: "House rules",
      rows: [
        ["Check-in", data.rules.checkInTime || "3:00 PM (default)"],
        ["Check-out", data.rules.checkOutTime || "11:00 AM (default)"],
        ["Pets", data.rules.petsAllowed || "—"],
      ],
    },
    {
      key: "compliance",
      label: "Compliance",
      rows: [
        ["Permit", data.compliance.permitRequired || "—"],
        ["Insurance", data.compliance.insuranceCarrier || "—"],
        ["HOA", data.compliance.hoaExists || "—"],
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        eyebrow="Step 9 of 9"
        title="Review and submit"
        body="Take a moment to double-check. You can always edit these details after the property is added."
      />
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <section
            key={g.key}
            className="rounded-xl border p-5"
            style={{
              backgroundColor: "var(--color-warm-gray-50)",
              borderColor: "var(--color-warm-gray-200)",
            }}
          >
            <header className="mb-3 flex items-center justify-between">
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {g.label}
              </h3>
              <button
                type="button"
                onClick={() => onJump(g.key)}
                className="text-[11px] font-semibold transition-opacity hover:opacity-80"
                style={{ color: "var(--color-brand)" }}
              >
                Edit
              </button>
            </header>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.rows.map(([label, value]) => (
                <div key={label}>
                  <dt
                    className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {label}
                  </dt>
                  <dd
                    className="text-sm"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

function deepMerge<T>(target: T, source: Partial<T>): T {
  const out = { ...target } as Record<string, unknown>;
  for (const k of Object.keys(source) as (keyof T)[]) {
    const sv = source[k];
    const tv = (target as Record<string, unknown>)[k as string];
    if (
      sv &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv &&
      typeof tv === "object"
    ) {
      out[k as string] = deepMerge(
        tv as Record<string, unknown>,
        sv as Record<string, unknown>,
      );
    } else if (sv !== undefined) {
      out[k as string] = sv;
    }
  }
  return out as T;
}
