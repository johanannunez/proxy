"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  CaretDown,
  CaretUp,
  Check,
  CheckCircle,
  CircleNotch,
  MagnifyingGlass,
  Minus,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  amenityCategories,
  type Amenity,
  type AmenityCategory,
  type AmenityDetailField,
  type AmenityDetails,
} from "@/lib/wizard/amenities";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import {
  saveAmenities,
  autosaveAmenities,
  type SaveAmenitiesState,
} from "./actions";
import { CustomSelect } from "@/components/workspace/CustomSelect";

const initialState: SaveAmenitiesState = {};

export function AmenitiesForm({
  propertyId,
  savedAmenities,
  savedDetails,
  isEditing,
}: {
  propertyId: string;
  savedAmenities: string[];
  savedDetails: AmenityDetails;
  isEditing: boolean;
}) {
  const [formState, formAction, formPending] = useActionState(
    saveAmenities,
    initialState,
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(savedAmenities),
  );
  const [details, setDetails] = useState<AmenityDetails>(savedDetails);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>(["guest_essentials"]);
    for (const cat of amenityCategories) {
      if (cat.items.some((i) => savedAmenities.includes(i.id))) {
        initial.add(cat.id);
      }
    }
    return initial;
  });
  const [search, setSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Refs for debounced auto-save
  const selectedRef = useRef(selected);
  const detailsRef = useRef(details);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);
  const [, startTransition] = useTransition();

  selectedRef.current = selected;
  detailsRef.current = details;

  const triggerAutosave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
    setSaveStatus("idle");

    saveTimerRef.current = setTimeout(() => {
      setSaveStatus("saving");
      startTransition(async () => {
        const result = await autosaveAmenities(
          propertyId,
          Array.from(selectedRef.current),
          detailsRef.current,
        );
        if (result.error) {
          setSaveStatus("error");
        } else {
          setSaveStatus("saved");
          savedFadeRef.current = setTimeout(
            () => setSaveStatus("idle"),
            3000,
          );
        }
      });
    }, 1500);
  }, [propertyId, startTransition]);

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    triggerAutosave();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [selected, details, triggerAutosave]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setDetails((d) => {
           
        const { [id]: _removed, ...rest } = d;
          return rest;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleCategory(cat: AmenityCategory) {
    const allIds = cat.items.map((i) => i.id);
    const allSelected = allIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleExpanded(catId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function updateDetail(amenityId: string, fieldKey: string, value: string) {
    setDetails((prev) => ({
      ...prev,
      [amenityId]: { ...(prev[amenityId] ?? {}), [fieldKey]: value },
    }));
  }

  function updateRepeaterCount(amenityId: string, newCount: number) {
    setDetails((prev) => {
      const current = { ...(prev[amenityId] ?? {}) };
      const oldCount = parseInt(current.count ?? "0", 10);
      current.count = String(newCount);
      // Remove data for items beyond the new count
      if (newCount < oldCount) {
        for (let i = newCount; i < oldCount; i++) {
          for (const key of Object.keys(current)) {
            if (key.startsWith(`item_${i}_`)) {
              delete current[key];
            }
          }
        }
      }
      return { ...prev, [amenityId]: current };
    });
  }

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return amenityCategories;
    const q = search.toLowerCase();
    return amenityCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) =>
          item.label.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [search]);

  // Collect all items that need detail rendering (have detailFields or repeater, and are selected)
  function getDetailItems(cat: AmenityCategory) {
    return cat.items.filter(
      (i) =>
        selected.has(i.id) &&
        ((i.detailFields && i.detailFields.length > 0) || i.repeater),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="property_id" value={propertyId} />
      <input
        type="hidden"
        name="amenities"
        value={JSON.stringify(Array.from(selected))}
      />
      <input
        type="hidden"
        name="details"
        value={JSON.stringify(details)}
      />

      {formState.error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm"
          style={{
            borderColor: "#f1c4c4",
            backgroundColor: "#fdf4f4",
            color: "#8a1f1f",
          }}
        >
          <WarningCircle
            size={18}
            weight="fill"
            style={{ color: "#c0372a" }}
          />
          <span>{formState.error}</span>
        </div>
      )}

      {/* Search bar */}
      <div
        className="flex items-center gap-3 rounded-xl border px-4 py-3"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <MagnifyingGlass
          size={18}
          weight="bold"
          style={{ color: "var(--color-text-tertiary)" }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search amenities..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
          style={{ color: "var(--color-text-primary)" }}
        />
        <div className="flex items-center gap-3">
          <SaveIndicator status={saveStatus} />
          <span
            className="shrink-0 text-xs font-medium tabular-nums"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {selected.size} selected
          </span>
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-3">
        {filteredCategories.map((cat) => {
          const isExpanded =
            expanded.has(cat.id) || search.trim().length > 0;
          const catCount = cat.items.filter((i) =>
            selected.has(i.id),
          ).length;
          const detailItems = getDetailItems(cat);
          const hasSelections = catCount > 0;

          return (
            <div
              key={cat.id}
              className="overflow-hidden rounded-2xl border transition-colors"
              style={{
                borderColor: hasSelections
                  ? "#02aaeb25"
                  : "var(--color-warm-gray-200)",
                backgroundColor: "var(--color-white)",
              }}
            >
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggleExpanded(cat.id)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-[var(--color-warm-gray-50)]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-[15px] font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {cat.label}
                  </span>
                  {catCount > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                      style={{
                        backgroundColor: "#02aaeb10",
                        color: "#02aaeb",
                      }}
                    >
                      {catCount} of {cat.items.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCategory(cat);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleCategory(cat);
                      }
                    }}
                    className="text-xs font-medium transition-colors hover:underline"
                    style={{ color: "#02aaeb" }}
                  >
                    {cat.items.every((i) => selected.has(i.id))
                      ? "Deselect all"
                      : "Select all"}
                  </span>
                  {isExpanded ? (
                    <CaretUp
                      size={14}
                      style={{ color: "var(--color-text-tertiary)" }}
                    />
                  ) : (
                    <CaretDown
                      size={14}
                      style={{ color: "var(--color-text-tertiary)" }}
                    />
                  )}
                </div>
              </button>

              {/* Expanded content: pills + detail fields */}
              {isExpanded && (
                <div
                  className="border-t px-4 pb-4 pt-3"
                  style={{ borderColor: "var(--color-warm-gray-100)" }}
                >
                  {/* Amenity pills */}
                  <div className="flex flex-wrap gap-2">
                    {cat.items.map((item) => {
                      const isSelected = selected.has(item.id);
                      const hasExtra =
                        (item.detailFields && item.detailFields.length > 0) ||
                        item.repeater;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggle(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] transition-colors"
                          style={{
                            borderColor: isSelected
                              ? "#02aaeb40"
                              : "var(--color-warm-gray-200)",
                            backgroundColor: isSelected
                              ? "#02aaeb08"
                              : "transparent",
                            color: isSelected
                              ? "#1b77be"
                              : "var(--color-text-secondary)",
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          {isSelected && (
                            <Check
                              size={13}
                              weight="bold"
                              style={{ color: "#02aaeb" }}
                            />
                          )}
                          {item.label}
                          {hasExtra && isSelected && (
                            <span
                              className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: "#02aaeb" }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Detail fields for selected items that need them */}
                  {detailItems.length > 0 && (
                    <div
                      className="mt-3 flex flex-col gap-5 rounded-xl p-4"
                      style={{
                        backgroundColor: "var(--color-warm-gray-50)",
                      }}
                    >
                      <p
                        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        Tell us more
                      </p>
                      {detailItems.map((item) => (
                        <DetailSection
                          key={item.id}
                          item={item}
                          details={details}
                          updateDetail={updateDetail}
                          updateRepeaterCount={updateRepeaterCount}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <StepSaveBar pending={formPending} isEditing={isEditing} />
    </form>
  );
}

/* ── Detail section for a single amenity ─────────────────── */

function DetailSection({
  item,
  details,
  updateDetail,
  updateRepeaterCount,
}: {
  item: Amenity;
  details: AmenityDetails;
  updateDetail: (amenityId: string, fieldKey: string, value: string) => void;
  updateRepeaterCount: (amenityId: string, newCount: number) => void;
}) {
  const itemDetails = details[item.id] ?? {};

  return (
    <div className="flex flex-col gap-3">
      <p
        className="text-[13px] font-semibold"
        style={{ color: "var(--color-text-primary)" }}
      >
        {item.label}
      </p>

      {/* Simple detail fields */}
      {item.detailFields && item.detailFields.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {item.detailFields.map((field) => (
            <DetailField
              key={field.key}
              field={field}
              value={itemDetails[field.key] ?? ""}
              onChange={(val) => updateDetail(item.id, field.key, val)}
            />
          ))}
        </div>
      )}

      {/* Repeater (e.g. TVs) */}
      {item.repeater && (
        <RepeaterSection
          amenityId={item.id}
          repeater={item.repeater}
          details={itemDetails}
          updateDetail={updateDetail}
          updateRepeaterCount={updateRepeaterCount}
        />
      )}
    </div>
  );
}

/* ── Single detail field (text, number, or select) ───────── */

function DetailField({
  field,
  value,
  onChange,
}: {
  field: AmenityDetailField;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label
        className="mb-1 block text-[11px] font-medium"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {field.label}
      </label>
      {field.type === "select" && field.options ? (
        <CustomSelect
          value={value}
          onChange={onChange}
          options={[{ value: "", label: "Select..." }, ...field.options]}
        />
      ) : (
        <input
          type={field.type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          min={field.type === "number" ? 0 : undefined}
          className="w-full rounded-lg border bg-[var(--color-white)] px-3 py-2 text-sm outline-none transition-colors focus:border-[#02aaeb]"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-primary)",
          }}
        />
      )}
    </div>
  );
}

/* ── Repeater section (count + per-item rows) ────────────── */

function RepeaterSection({
  amenityId,
  repeater,
  details,
  updateDetail,
  updateRepeaterCount,
}: {
  amenityId: string;
  repeater: NonNullable<Amenity["repeater"]>;
  details: Record<string, string>;
  updateDetail: (amenityId: string, fieldKey: string, value: string) => void;
  updateRepeaterCount: (amenityId: string, newCount: number) => void;
}) {
  const count = Math.min(
    parseInt(details.count ?? "0", 10) || 0,
    repeater.maxCount,
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Count control */}
      <div className="flex items-center gap-3">
        <label
          className="text-[12px] font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {repeater.countLabel}
        </label>
        <div
          className="inline-flex items-center gap-0 rounded-lg border"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <button
            type="button"
            onClick={() => updateRepeaterCount(amenityId, Math.max(0, count - 1))}
            disabled={count <= 0}
            className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-[var(--color-warm-gray-50)] disabled:opacity-30"
          >
            <Minus size={12} weight="bold" style={{ color: "var(--color-text-secondary)" }} />
          </button>
          <span
            className="flex h-8 w-10 items-center justify-center border-x text-sm font-semibold tabular-nums"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              color: "var(--color-text-primary)",
            }}
          >
            {count}
          </span>
          <button
            type="button"
            onClick={() =>
              updateRepeaterCount(
                amenityId,
                Math.min(repeater.maxCount, count + 1),
              )
            }
            disabled={count >= repeater.maxCount}
            className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-[var(--color-warm-gray-50)] disabled:opacity-30"
          >
            <Plus size={12} weight="bold" style={{ color: "var(--color-text-secondary)" }} />
          </button>
        </div>
      </div>

      {/* Per-item rows */}
      {count > 0 && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border bg-[var(--color-white)] p-3 sm:flex-row sm:items-end sm:gap-3"
              style={{ borderColor: "var(--color-warm-gray-200)" }}
            >
              <p
                className="shrink-0 text-[12px] font-semibold sm:pb-2"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {repeater.itemLabel} {i + 1}
              </p>
              {repeater.fields.map((field) => (
                <div key={field.key} className="flex-1">
                  <label
                    className="mb-1 block text-[11px] font-medium"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {field.label}
                  </label>
                  {field.type === "select" && field.options ? (
                    <CustomSelect
                      value={details[`item_${i}_${field.key}`] ?? ""}
                      onChange={(v) =>
                        updateDetail(
                          amenityId,
                          `item_${i}_${field.key}`,
                          v,
                        )
                      }
                      options={[{ value: "", label: "Select..." }, ...field.options]}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={details[`item_${i}_${field.key}`] ?? ""}
                      onChange={(e) =>
                        updateDetail(
                          amenityId,
                          `item_${i}_${field.key}`,
                          e.target.value,
                        )
                      }
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border bg-[var(--color-white)] px-3 py-2 text-sm outline-none transition-colors focus:border-[#02aaeb]"
                      style={{
                        borderColor: "var(--color-warm-gray-200)",
                        color: "var(--color-text-primary)",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Save status indicator ───────────────────────────────── */

function SaveIndicator({
  status,
}: {
  status: "idle" | "saving" | "saved" | "error";
}) {
  if (status === "saving") {
    return (
      <span
        className="flex items-center gap-1 text-[11px] font-medium"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <CircleNotch size={12} weight="bold" className="animate-spin" />
        Saving
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span
        className="flex items-center gap-1 text-[11px] font-medium"
        style={{ color: "#16a34a" }}
      >
        <CheckCircle size={13} weight="fill" />
        Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="flex items-center gap-1 text-[11px] font-medium"
        style={{ color: "#c0372a" }}
      >
        <WarningCircle size={13} weight="fill" />
        Not saved
      </span>
    );
  }
  return null;
}
