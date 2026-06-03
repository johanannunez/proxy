import type { Metadata } from "next";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { normalizeUnit } from "@/lib/address";
import { EmptyState } from "@/components/workspace/EmptyState";
import { ReserveForm } from "../ReserveForm";
import { MyReservationsList } from "../MyReservationsList";
import type { BlockRequest, ReserveProperty } from "../types";

export const metadata: Metadata = { title: "New Reservation" };
export const dynamic = "force-dynamic";

export default async function NewReservationPage() {
  const { userId, client, ownerProfile, isImpersonating } = await getWorkspaceContext();

  const [
    { data: properties },
    { data: profile },
    { data: rules },
    requestsResult,
  ] = await Promise.all([
    client
      .from("properties")
      .select(
        "id, address_line1, address_line2, city, state, postal_code, bedrooms",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
    client
      .from("profiles")
      .select("full_name, phone, email, avatar_url")
      .eq("id", userId)
      .single(),
    client
      .from("property_rules")
      .select("property_id, pets_allowed, pet_fee, cleaning_fee"),
    client
      .from("block_requests")
      .select(
        "id, property_id, start_date, end_date, status, note, created_at, check_in_time, check_out_time, reason, is_owner_staying, guest_name, guest_email, guest_phone, adults, children, pets, needs_lock_code, requested_lock_code, wants_cleaning, cleaning_fee, damage_acknowledged",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const rulesByProperty = new Map<
    string,
    {
      pets_allowed: boolean | null;
      pet_fee: number | null;
      cleaning_fee: number | null;
    }
  >();
  (rules ?? []).forEach((r) => {
    rulesByProperty.set(r.property_id, {
      pets_allowed: r.pets_allowed,
      pet_fee: r.pet_fee ? Number(r.pet_fee) : null,
      cleaning_fee: r.cleaning_fee ? Number(r.cleaning_fee) : null,
    });
  });

  const propertyList: ReserveProperty[] = (properties ?? []).map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawUnit = (p as any).address_line2 as string | null | undefined;
    const unit = rawUnit ? normalizeUnit(rawUnit) : null;
    const name = p.address_line1?.trim() || "Property";
    const address = [p.city, p.state, p.postal_code]
      .filter(Boolean)
      .join(", ");
    const rule = rulesByProperty.get(p.id) ?? null;
    return {
      id: p.id,
      name,
      unit,
      address,
      bedrooms: (p as { bedrooms?: number | null }).bedrooms ?? null,
      petsAllowed: rule?.pets_allowed ?? null,
      cleaningFee: rule?.cleaning_fee ?? null,
      petFee: rule?.pet_fee ?? null,
    };
  });

  const hasProperties = propertyList.length > 0;
  const fullName =
    profile?.full_name?.trim() ||
    (profile as { email?: string | null })?.email?.split("@")[0] ||
    "Owner";
  const ownerEmail =
    (profile as { email?: string | null })?.email ??
    (isImpersonating ? (ownerProfile?.email ?? "") : "");
  const ownerAvatarUrl =
    (profile as { avatar_url?: string | null })?.avatar_url ?? null;

  const requests: BlockRequest[] = (requestsResult.data ?? []).map((r) => ({
    id: r.id,
    property_id: r.property_id,
    start_date: r.start_date,
    end_date: r.end_date,
    status: r.status as BlockRequest["status"],
    note: r.note,
    created_at: r.created_at,
    check_in_time: r.check_in_time,
    check_out_time: r.check_out_time,
    reason: r.reason,
    is_owner_staying: r.is_owner_staying ?? true,
    guest_name: r.guest_name,
    guest_email: r.guest_email,
    guest_phone: r.guest_phone,
    adults: r.adults ?? 1,
    children: r.children ?? 0,
    pets: r.pets ?? 0,
    needs_lock_code: r.needs_lock_code ?? false,
    requested_lock_code: r.requested_lock_code,
    wants_cleaning: r.wants_cleaning ?? false,
    cleaning_fee: r.cleaning_fee ? Number(r.cleaning_fee) : null,
    damage_acknowledged: r.damage_acknowledged ?? false,
  }));

  if (!hasProperties) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          icon={<CalendarBlank size={26} weight="duotone" />}
          title="Reserve unlocks with your first property"
          body="Add a home and you'll be able to reserve time in it right here."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 pb-12">
      <ReserveForm
        properties={propertyList}
        ownerName={fullName}
        ownerEmail={ownerEmail}
        ownerPhone={(profile as { phone?: string | null })?.phone ?? ""}
        ownerAvatarUrl={ownerAvatarUrl}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Your reservations
          </h2>
          <p
            className="text-[13px]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Every block you&apos;ve sent, grouped by status.
          </p>
        </div>
        <MyReservationsList
          requests={requests}
          properties={propertyList.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </div>
  );
}
