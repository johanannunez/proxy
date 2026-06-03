import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { BasicsForm, type BasicsInitial } from "./BasicsForm";

export const metadata: Metadata = {
  title: "Property basics",
};

export const dynamic = "force-dynamic";

export default async function SetupBasicsPage({
  searchParams,
}: {
  searchParams?: Promise<{ property?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const params = await searchParams;
  const propertyId = params?.property ?? null;

  let query = supabase
    .from("properties")
    .select(
      "id, name, property_type, home_type, address_line1, address_line2, city, state, postal_code, country, bedrooms, bathrooms, square_feet, guest_capacity, updated_at",
    );

  if (propertyId) {
    query = query.eq("id", propertyId);
  } else {
    query = query.order("created_at", { ascending: true }).limit(1);
  }

  const { data: property } = await query.maybeSingle();

  const initial: BasicsInitial = {
    property_id: property?.id ?? "",
    name: property?.name ?? "",
    property_type: (property?.property_type ?? "") as BasicsInitial["property_type"],
    home_type: (property?.home_type ?? "") as BasicsInitial["home_type"],
    address_line1: property?.address_line1 ?? "",
    address_line2: property?.address_line2 ?? "",
    city: property?.city ?? "",
    state: property?.state ?? "",
    postal_code: property?.postal_code ?? "",
    country: property?.country ?? "US",
    bedrooms:
      property?.bedrooms !== null && property?.bedrooms !== undefined
        ? String(property.bedrooms)
        : "",
    bathrooms:
      property?.bathrooms !== null && property?.bathrooms !== undefined
        ? String(property.bathrooms)
        : "",
    square_feet:
      property?.square_feet !== null && property?.square_feet !== undefined
        ? String(property.square_feet)
        : "",
    guest_capacity:
      property?.guest_capacity !== null &&
      property?.guest_capacity !== undefined
        ? String(property.guest_capacity)
        : "",
  };

  const isEditing = Boolean(property);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <Link
          href={
            propertyId
              ? `/workspace/setup?property=${propertyId}`
              : "/workspace/setup"
          }
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <ArrowLeft size={14} weight="bold" />
          Back to setup
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Track 01 · Step 02
            </p>
            <span
              className="text-[11px]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              About 3 min
            </span>
          </div>
          <h1
            className="mt-2 text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]"
            style={{ color: "var(--color-text-primary)" }}
          >
            The basics
          </h1>
          <p
            className="mt-2 max-w-2xl text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            We use this to create your property record and start building your listing. Nickname, type, and specs.
          </p>
          {isEditing && property?.updated_at && (
            <p
              className="mt-1.5 text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Last updated{" "}
              {new Date(property.updated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              at{" "}
              {new Date(property.updated_at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          )}
        </div>
      </header>

      <BasicsForm initial={initial} isEditing={isEditing} />
    </div>
  );
}
