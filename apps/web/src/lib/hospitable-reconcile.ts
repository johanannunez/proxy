import {
  getProperty as getHospitableProperty,
  type HospitableProperty,
} from "@/lib/hospitable";
import {
  HOSPITABLE_TYPE_TO_HOME_TYPE,
  homeTypeLabels,
} from "@/lib/labels";

/**
 * One mismatched field between the Proxy row (source of truth) and the
 * Hospitable listing. The UI renders a row per mismatch in the drift
 * panel on the property detail page.
 */
export type PropertyFieldDiff = {
  field: "home_type" | "bedrooms" | "bathrooms" | "guest_capacity";
  label: string;
  proxyValue: string;
  hospitableValue: string;
  /**
   * "unmappable" means Hospitable's taxonomy has no direct equivalent for
   * Proxy's value (e.g. Proxy "duplex" -> Hospitable has no duplex).
   * "mismatch" means both sides have defined values that disagree.
   */
  kind: "mismatch" | "unmappable";
};

export type HospitableReconcileResult = {
  /** True when this property is linked to a Hospitable listing. */
  linked: boolean;
  /** Present when linked and the API call succeeded. */
  hospitable: HospitableProperty | null;
  /** Empty array when everything matches, one entry per drift row otherwise. */
  diffs: PropertyFieldDiff[];
  /**
   * Human-readable reason when we can't compare (no link, or API failure).
   * null when the comparison ran cleanly (regardless of whether diffs exist).
   */
  error: string | null;
};

type ProxyPropertyLike = {
  hospitable_property_id: string | null;
  home_type: string | null;
  bedrooms: number | null;
  bathrooms: string | number | null;
  guest_capacity: number | null;
};

/**
 * Compare a Proxy property row against its linked Hospitable listing and
 * return a list of fields that drift. Proxy is the source of truth; the
 * caller surfaces the drift so the user can fix either Proxy's record or
 * the OTA listing itself.
 *
 * Square footage is intentionally NOT compared because Hospitable doesn't
 * track it (their API returns no area / sqft / size field anywhere on the
 * property object). That stays a Proxy-owned field forever.
 *
 * Bathrooms come out of Postgres as a numeric string like "2.0" so we
 * coerce both sides to numbers before comparing.
 */
export async function reconcilePropertyWithHospitable(
  property: ProxyPropertyLike,
): Promise<HospitableReconcileResult> {
  if (!property.hospitable_property_id) {
    return {
      linked: false,
      hospitable: null,
      diffs: [],
      error: null,
    };
  }

  let hospitable: HospitableProperty | null;
  try {
    hospitable = await getHospitableProperty(property.hospitable_property_id);
  } catch {
    return {
      linked: true,
      hospitable: null,
      diffs: [],
      error: "Hospitable request failed.",
    };
  }

  if (!hospitable) {
    return {
      linked: true,
      hospitable: null,
      diffs: [],
      error: "Hospitable property not found.",
    };
  }

  const diffs: PropertyFieldDiff[] = [];

  // home_type: map Hospitable's raw property_type onto Proxy's enum.
  if (property.home_type && hospitable.property_type) {
    const mapped = HOSPITABLE_TYPE_TO_HOME_TYPE[hospitable.property_type];
    if (!mapped) {
      diffs.push({
        field: "home_type",
        label: "Home type",
        proxyValue:
          homeTypeLabels[property.home_type] ?? property.home_type,
        hospitableValue: prettifyHospitableType(hospitable.property_type),
        kind: "unmappable",
      });
    } else if (mapped !== property.home_type) {
      diffs.push({
        field: "home_type",
        label: "Home type",
        proxyValue:
          homeTypeLabels[property.home_type] ?? property.home_type,
        hospitableValue:
          homeTypeLabels[mapped] ?? prettifyHospitableType(hospitable.property_type),
        kind: "mismatch",
      });
    }
  }

  // bedrooms
  const hospBedrooms = hospitable.capacity?.bedrooms ?? null;
  if (
    property.bedrooms != null &&
    hospBedrooms != null &&
    property.bedrooms !== hospBedrooms
  ) {
    diffs.push({
      field: "bedrooms",
      label: "Bedrooms",
      proxyValue: String(property.bedrooms),
      hospitableValue: String(hospBedrooms),
      kind: "mismatch",
    });
  }

  // bathrooms: coerce both sides to Number since Postgres numeric comes
  // back as a string.
  const proxyBathrooms =
    property.bathrooms != null ? Number(property.bathrooms) : null;
  const hospBathrooms = hospitable.capacity?.bathrooms ?? null;
  if (
    proxyBathrooms != null &&
    hospBathrooms != null &&
    proxyBathrooms !== hospBathrooms
  ) {
    diffs.push({
      field: "bathrooms",
      label: "Bathrooms",
      proxyValue: String(proxyBathrooms),
      hospitableValue: String(hospBathrooms),
      kind: "mismatch",
    });
  }

  // guest_capacity
  const hospMaxGuests = hospitable.capacity?.max ?? null;
  if (
    property.guest_capacity != null &&
    hospMaxGuests != null &&
    property.guest_capacity !== hospMaxGuests
  ) {
    diffs.push({
      field: "guest_capacity",
      label: "Sleeps",
      proxyValue: String(property.guest_capacity),
      hospitableValue: String(hospMaxGuests),
      kind: "mismatch",
    });
  }

  return {
    linked: true,
    hospitable,
    diffs,
    error: null,
  };
}

/** "condominium" → "Condominium". Best-effort fallback for unmapped types. */
function prettifyHospitableType(raw: string): string {
  return raw
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
