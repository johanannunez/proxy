/**
 * Geocoding utilities. Currently uses OpenStreetMap Nominatim.
 * To swap in Google Places later, only change the implementation
 * of reverseGeocode() and forwardGeocode() below.
 */

export type GeocodedAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
};

/**
 * Reverse geocode coordinates into an address.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeocodedAddress | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: { "User-Agent": "ProxyWorkspace/1.0" },
      },
    );
    if (!res.ok) return null;

    const data = await res.json();
    const addr = data.address ?? {};

    return {
      street: [addr.house_number, addr.road].filter(Boolean).join(" "),
      city: addr.city || addr.town || addr.village || "",
      state: addr.state || "",
      zip: addr.postcode || "",
      lat,
      lng,
    };
  } catch {
    return null;
  }
}

/**
 * Forward geocode an address string into coordinates.
 */
export async function forwardGeocode(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: { "User-Agent": "ProxyWorkspace/1.0" },
      },
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data[0]) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}
