"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "@phosphor-icons/react";
import { formatStreet, formatAddress } from "@/lib/address";

type PropertyOption = {
  id: string;
  address_line1: string | null;
  address_line2?: string | null;
  city: string | null;
  state: string | null;
  postal_code?: string | null;
  /** Kept for backward compat, no longer used for display. */
  name?: string | null;
};

type Props = {
  properties: PropertyOption[];
  activeId: string;
};

export function PropertySwitcher({ properties, activeId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (properties.length < 2) return null;

  function handleSelect(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("property", id);
    params.delete("just");
    router.push(`/workspace/setup?${params.toString()}`);
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 rounded-xl p-1.5"
      style={{ backgroundColor: "var(--color-warm-gray-50)" }}
    >
      {properties.map((p) => {
        const isActive = p.id === activeId;
        const label = formatStreet(p) || formatAddress(p) || "Property";
        const sub = [p.city, p.state].filter(Boolean).join(", ");

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => handleSelect(p.id)}
            className="flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-left transition-all duration-150"
            style={{
              backgroundColor: isActive
                ? "var(--color-white)"
                : "transparent",
              boxShadow: isActive
                ? "0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)"
                : "none",
              borderLeft: isActive
                ? "2.5px solid var(--color-brand)"
                : "2.5px solid transparent",
              cursor: isActive ? "default" : "pointer",
            }}
          >
            <MapPin
              size={16}
              weight="duotone"
              style={{
                color: isActive
                  ? "var(--color-brand)"
                  : "var(--color-text-tertiary)",
                flexShrink: 0,
              }}
            />
            <div className="min-w-0">
              <p
                className="truncate text-sm leading-tight"
                style={{
                  color: isActive
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {label}
              </p>
              {sub && (
                <p
                  className="truncate text-[11px] leading-tight"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {sub}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
