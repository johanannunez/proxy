import type { Metadata } from "next";
import { Buildings, Plus } from "@phosphor-icons/react/dist/ssr";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { formatStreet } from "@/lib/address";
import { EmptyState } from "@/components/workspace/EmptyState";
import { LinkButton } from "@/components/workspace/Button";
import { PropertiesView } from "./components/PropertiesView";
import type { ImageSource } from "./actions";
import type { PropertyRowData } from "./components/types";

export const metadata: Metadata = { title: "Properties" };
export const dynamic = "force-dynamic";

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY ?? null;

function mapsAerialUrl(
  address: string,
  city: string,
  state: string,
): string | null {
  if (!MAPS_KEY) return null;
  const loc = [address, city, state].filter(Boolean).join(", ");
  return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(loc)}&zoom=18&size=760x460&maptype=satellite&key=${MAPS_KEY}`;
}

function mapsStreetUrl(
  address: string,
  city: string,
  state: string,
): string | null {
  if (!MAPS_KEY) return null;
  const loc = [address, city, state].filter(Boolean).join(", ");
  return `https://maps.googleapis.com/maps/api/streetview?size=760x460&location=${encodeURIComponent(loc)}&fov=90&key=${MAPS_KEY}`;
}

export default async function PropertiesPage() {
  const { userId, client } = await getWorkspaceContext();

  // Base property data — columns known to exist in the schema
  const { data: properties } = await client
    .from("properties")
    .select(
      "id, address_line1, address_line2, city, state, postal_code, home_type, bedrooms, bathrooms, guest_capacity, square_feet, active, created_at",
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  // image_source and cover_photo_url require the schema migration below.
  // Wrapped in a try/catch so the page renders cleanly before the migration runs.
  //
  // SQL to run once in Supabase SQL Editor:
  //   ALTER TABLE properties
  //     ADD COLUMN IF NOT EXISTS image_source TEXT
  //       CHECK (image_source IN ('aerial','street','photo'))
  //       DEFAULT 'aerial';
  //   ALTER TABLE properties
  //     ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
  const imageMap = new Map<
    string,
    { source: ImageSource; coverUrl: string | null; streetViewAvailable: boolean }
  >();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: imgRows } = await (client as any)
      .from("properties")
      .select("id, image_source, cover_photo_url, street_view_available")
      .eq("owner_id", userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (imgRows ?? []).forEach((row: any) => {
      imageMap.set(row.id, {
        source: (row.image_source ?? "aerial") as ImageSource,
        coverUrl: row.cover_photo_url ?? null,
        streetViewAvailable: row.street_view_available ?? true,
      });
    });
  } catch {
    // columns don't exist yet — safe defaults
  }

  const rows: PropertyRowData[] = (properties ?? []).map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const address = formatStreet({ address_line1: p.address_line1, address_line2: (p as any).address_line2 });
    const city = p.city ?? "";
    const state = p.state ?? "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const postalCode = (p as any).postal_code ?? "";
    const img = imageMap.get(p.id) ?? {
      source: "aerial" as ImageSource,
      coverUrl: null,
      streetViewAvailable: true,
    };
    return {
      id: p.id,
      address,
      city,
      state,
      postalCode,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      homeType: (p as any).home_type ?? null,
      bedrooms: p.bedrooms ?? null,
      bathrooms: p.bathrooms ?? null,
      guests: p.guest_capacity ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sqft: (p as any).square_feet ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      active: (p as any).active ?? true,
      imageSource: img.source,
      coverPhotoUrl: img.coverUrl,
      aerialUrl: mapsAerialUrl(address, city, state),
      streetUrl: mapsStreetUrl(address, city, state),
      streetViewAvailable: img.streetViewAvailable,
    };
  });

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          icon={<Buildings size={26} weight="duotone" />}
          title="No properties yet"
          body="Add your first home to unlock the dashboard, calendar, and payouts. The onboarding wizard takes about five minutes."
          action={
            <LinkButton href="/workspace/setup/basics">
              <Plus size={16} weight="bold" />
              Add your first property
            </LinkButton>
          }
        />
      </div>
    );
  }

  return <PropertiesView properties={rows} />;
}
