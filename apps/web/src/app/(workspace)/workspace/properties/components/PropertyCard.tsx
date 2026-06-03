"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GearSix, Bed, Bathtub, Users as UsersIcon, Ruler, House } from "@phosphor-icons/react";
import { homeTypeLabels } from "@/lib/labels";
import type { ImageSource } from "../actions";
import { updatePropertyImageSource } from "../actions";
import type { PropertyRowData } from "./types";
import { PropertySettingsModal } from "./PropertySettingsModal";

const PILL_TABS: Array<{ value: ImageSource; label: string }> = [
  { value: "aerial", label: "Aerial" },
  { value: "street", label: "Street" },
  { value: "photo", label: "Photo" },
];


/** Proxy brand gradient shown when no image URL is available */
const FALLBACK_GRADIENT =
  "linear-gradient(135deg, #1B77BE 0%, #02AAEB 55%, #72CFF5 100%)";

export function PropertyCard({ property }: { property: PropertyRowData }) {
  const [imageSource, setImageSource] = useState<ImageSource>(
    property.imageSource,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, startTransition] = useTransition();

  function currentImageUrl(): string | null {
    if (imageSource === "aerial") return property.aerialUrl;
    if (imageSource === "street") return property.streetUrl;
    if (imageSource === "photo") return property.coverPhotoUrl;
    return null;
  }

  function handlePillClick(
    e: React.MouseEvent,
    source: ImageSource,
  ) {
    e.preventDefault();
    e.stopPropagation();
    if (source === imageSource) return;
    setImageSource(source); // optimistic
    startTransition(() => {
      updatePropertyImageSource(property.id, source).then((res) => {
        if (!res.ok) setImageSource(property.imageSource); // revert on error
      });
    });
  }

  function handleGearClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSettingsOpen(true);
  }

  const imgUrl = currentImageUrl();
  const homeTypeLabel = property.homeType
    ? (homeTypeLabels[property.homeType] ?? property.homeType)
    : null;

  return (
    <>
      <article
        className="group relative overflow-hidden rounded-2xl border transition-[box-shadow] duration-300 hover:shadow-[0_16px_40px_-12px_rgba(15,23,42,0.18)]"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        {/* Photo zone */}
        <Link
          href={`/workspace/properties/${property.id}`}
          aria-label={`Open ${property.address}`}
          className="block"
          tabIndex={-1}
        >
          <div className="relative h-[230px] overflow-hidden">
            {imgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgUrl}
                alt={property.address}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: FALLBACK_GRADIENT }}
              />
            )}

            {/* Subtle bottom gradient for readability of pill tabs */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)",
              }}
            />

            {/* Active / Paused badge — top left */}
            <span
              className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm"
              style={{
                backgroundColor: property.active
                  ? "rgba(22, 163, 74, 0.82)"
                  : "rgba(60, 55, 53, 0.75)",
                color: "#fff",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: property.active ? "#86efac" : "rgba(255,255,255,0.6)",
                }}
              />
              {property.active ? "Active" : "Paused"}
            </span>

            {/* Gear icon — top right, appears on hover */}
            <button
              type="button"
              onClick={handleGearClick}
              aria-label="Property settings"
              className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 hover:scale-105"
              style={{
                backgroundColor: "rgba(0,0,0,0.35)",
                color: "#fff",
              }}
            >
              <GearSix size={14} weight="bold" />
            </button>

            {/* Image source pill tabs — bottom center */}
            <div
              className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center overflow-hidden rounded-full backdrop-blur-sm"
              style={{
                backgroundColor: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {PILL_TABS.map((tab) => {
                const isActive = tab.value === imageSource;
                const isDisabled =
                  tab.value === "street" && !property.streetViewAvailable;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={(e) => handlePillClick(e, tab.value)}
                    disabled={isDisabled}
                    title={isDisabled ? "No street view available for this address" : undefined}
                    className="px-3 py-1 text-[11px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: isActive
                        ? "rgba(255,255,255,0.95)"
                        : "transparent",
                      color: isDisabled
                        ? "rgba(255,255,255,0.3)"
                        : isActive
                          ? "#1a1a1a"
                          : "rgba(255,255,255,0.75)",
                      borderRadius: "9999px",
                    }}
                    aria-pressed={isActive}
                    aria-disabled={isDisabled}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Link>

        {/* Card body — always navigates */}
        <Link
          href={`/workspace/properties/${property.id}`}
          aria-label={`View details for ${property.address}`}
          className="block px-4 pb-4 pt-3 text-center"
        >
          {/* Address + city/state/zip — single line, mixed weights */}
          <p className="truncate text-[17px] leading-tight">
            <span className="font-bold" style={{ color: "var(--color-text-primary)" }}>
              {property.address}
            </span>
            {(property.city || property.state || property.postalCode) && (
              <span
                className="ml-2 font-light text-[14px]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {[property.city, property.state, property.postalCode].filter(Boolean).join(", ")}
              </span>
            )}
          </p>

          {/* Stats — single line, all five stats separated by dots */}
          <div
            className="mt-3 flex items-center justify-center gap-2.5 rounded-lg px-3 py-2 text-[12px] flex-wrap"
            style={{
              backgroundColor: "rgba(2, 170, 235, 0.10)",
              border: "1px solid rgba(2, 170, 235, 0.22)",
              boxShadow: "inset 0 0 18px rgba(2, 170, 235, 0.14), inset 0 1px 6px rgba(27, 119, 190, 0.12)",
              color: "#1B77BE",
            }}
          >
            <StatChip
              icon={<Bed size={13} weight="duotone" />}
              label={property.bedrooms != null ? `${property.bedrooms} bd` : "—"}
            />
            <Dot />
            <StatChip
              icon={<Bathtub size={13} weight="duotone" />}
              label={property.bathrooms != null ? `${property.bathrooms} ba` : "—"}
            />
            <Dot />
            <StatChip
              icon={<UsersIcon size={13} weight="duotone" />}
              label={property.guests != null ? `${property.guests} guests` : "—"}
            />
            <Dot />
            <StatChip
              icon={<Ruler size={13} weight="duotone" />}
              label={property.sqft != null ? `${property.sqft.toLocaleString()} sqft` : "—"}
            />
            {homeTypeLabel && (
              <>
                <Dot />
                <StatChip
                  icon={<House size={13} weight="duotone" />}
                  label={homeTypeLabel}
                />
              </>
            )}
          </div>
        </Link>
      </article>

      {settingsOpen && (
        <PropertySettingsModal
          propertyId={property.id}
          address={property.address}
          currentSource={imageSource}
          streetViewAvailable={property.streetViewAvailable}
          onClose={() => setSettingsOpen(false)}
          onSourceChange={(src) => setImageSource(src)}
        />
      )}
    </>
  );
}

function StatChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {icon}
      {label}
    </span>
  );
}

function Dot() {
  return (
    <span
      className="h-1 w-1 rounded-full shrink-0"
      style={{ backgroundColor: "rgba(2, 170, 235, 0.4)" }}
    />
  );
}
