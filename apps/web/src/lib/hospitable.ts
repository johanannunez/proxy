const BASE_URL = "https://public.api.hospitable.com/v2";

/**
 * Hard cap on every Hospitable API call so a slow or dead upstream can
 * never block a portal page render indefinitely. Picked deliberately on
 * the short side: typical Hospitable response time is 150-400ms, so
 * 4 seconds is ~10x the expected latency. If a request exceeds this,
 * the caller (usually the reconcile helper) surfaces a degraded state
 * rather than hanging the page.
 */
const REQUEST_TIMEOUT_MS = 4000;

/**
 * Returns true when the Hospitable integration is configured.
 */
export function hasHospitable(): boolean {
  return Boolean(process.env.HOSPITABLE_API);
}

function getToken(): string {
  const token = process.env.HOSPITABLE_API;
  if (!token) throw new Error("HOSPITABLE_API is not set");
  return token;
}

async function request<T>(
  path: string,
  options?: { params?: Record<string, string>; revalidate?: number },
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/json",
      },
      next: { revalidate: options?.revalidate ?? 3600 },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Hospitable API error ${res.status} on ${path}: ${body}`,
      );
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        `Hospitable API timeout after ${REQUEST_TIMEOUT_MS}ms on ${path}`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HospitableProperty {
  id: string;
  name: string;
  public_name?: string;
  picture?: string;
  address?: {
    display?: string;
    number?: string;
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  listed?: boolean;
  /**
   * Hospitable's building-type taxonomy: "house", "apartment",
   * "condominium", "townhouse", "cabin", "loft", etc. Mirrors Airbnb.
   * Used by `lib/hospitable-reconcile.ts` to detect drift between the
   * Proxy-owned `home_type` enum and the OTA listing.
   */
  property_type?: string;
  /** "Entire Home", "Private Room", "Shared Room", "Hotel Room". */
  room_type?: string;
  capacity?: {
    max?: number;
    bedrooms?: number;
    beds?: number;
    bathrooms?: number;
  };
}

export interface HospitableGuest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

export interface HospitableFinancialLine {
  amount?: number;
  formatted?: string;
  label?: string;
  category?: string;
}

export interface HospitableFinancials {
  currency?: string;
  host?: {
    accommodation?: HospitableFinancialLine;
    guest_fees?: HospitableFinancialLine[];
    host_fees?: HospitableFinancialLine[];
    revenue?: HospitableFinancialLine;
  };
  guest?: {
    accommodation?: HospitableFinancialLine;
    average_nightly_rate?: HospitableFinancialLine;
    fees?: HospitableFinancialLine[];
    taxes?: HospitableFinancialLine[];
    total_price?: HospitableFinancialLine;
  };
}

export interface HospitableReservation {
  id: string;
  property_id?: string;
  platform?: string;
  platform_id?: string;
  status?: { category?: string };
  dates?: {
    arrival?: string;
    departure?: string;
    booking?: string;
  };
  nights?: number;
  guest_count?: { adults?: number; children?: number; infants?: number };
  guest?: HospitableGuest;
  financials?: HospitableFinancials;
  properties?: { data?: HospitableProperty[] };
}

export interface HospitableCalendarDay {
  date: string;
  price?: { amount?: number; formatted?: string; currency?: string };
  status?: { available?: boolean };
  min_stay?: number;
}

interface PaginatedResponse<T> {
  data: T[];
  links?: { next?: string | null };
  meta?: { current_page?: number; last_page?: number };
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export async function getProperties(): Promise<HospitableProperty[]> {
  if (!hasHospitable()) return [];

  const all: HospitableProperty[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await request<PaginatedResponse<HospitableProperty>>(
      "/properties",
      { params: { page: String(page), per_page: "100" }, revalidate: 0 },
    );
    all.push(...res.data);
    hasMore = res.links?.next != null;
    page++;
  }

  return all;
}

export async function getProperty(
  id: string,
): Promise<HospitableProperty | null> {
  if (!hasHospitable()) return null;

  try {
    const res = await request<{ data: HospitableProperty }>(
      `/properties/${id}`,
    );
    return res.data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export async function getReservations(
  propertyIds: string[],
  opts?: { startDate?: string; endDate?: string },
): Promise<HospitableReservation[]> {
  if (!hasHospitable() || propertyIds.length === 0) return [];

  const all: HospitableReservation[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params: Record<string, string> = {
      page: String(page),
      per_page: "100",
      include: "guest,financials,properties",
    };

    // The API requires properties[] parameter
    propertyIds.forEach((id, i) => {
      params[`properties[${i}]`] = id;
    });

    if (opts?.startDate) params.start_date = opts.startDate;
    if (opts?.endDate) params.end_date = opts.endDate;

    const res = await request<PaginatedResponse<HospitableReservation>>(
      "/reservations",
      { params, revalidate: 0 },
    );
    all.push(...res.data);
    hasMore = res.links?.next != null;
    page++;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export async function getCalendar(
  propertyId: string,
  startDate?: string,
  endDate?: string,
): Promise<HospitableCalendarDay[]> {
  if (!hasHospitable()) return [];

  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const res = await request<{ data: HospitableCalendarDay[] }>(
    `/properties/${propertyId}/calendar`,
    { params, revalidate: 0 },
  );

  return res.data;
}

// ---------------------------------------------------------------------------
// Platform to booking_source mapping
// ---------------------------------------------------------------------------

const PLATFORM_MAP: Record<string, string> = {
  airbnb: "airbnb",
  homeaway: "vrbo",
  vrbo: "vrbo",
  "booking.com": "booking_com",
  booking: "booking_com",
  direct: "direct",
  hospitable: "hospitable",
  manual: "direct",
};

export function mapPlatformToSource(
  platform?: string,
): string {
  if (!platform) return "other";
  return PLATFORM_MAP[platform.toLowerCase()] ?? "other";
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export interface HospitableReview {
  id: string;
  public?: { rating?: number; review?: string };
  private?: { feedback?: string | null };
  reviewed_at?: string;
  guest?: { first_name?: string };
}

export async function getPropertyReviews(
  propertyId: string,
  limit = 20,
): Promise<HospitableReview[]> {
  if (!hasHospitable()) return [];
  try {
    const res = await request<PaginatedResponse<HospitableReview>>(
      `/properties/${propertyId}/reviews`,
      { params: { per_page: String(limit), include: 'guest' }, revalidate: 3600 },
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Messages / Conversations
// ---------------------------------------------------------------------------

export interface HospitableMessage {
  id: string;
  body?: string;
  from?: 'guest' | 'host';
  created_at?: string;
}

export interface HospitableConversation {
  id: string;
  property_id?: string;
  guest?: { first_name?: string };
  messages?: HospitableMessage[];
  last_message_at?: string;
}

export async function getPropertyConversations(
  propertyId: string,
  limit = 10,
): Promise<HospitableConversation[]> {
  if (!hasHospitable()) return [];
  try {
    const res = await request<PaginatedResponse<HospitableConversation>>('/conversations', {
      params: { 'properties[]': propertyId, per_page: String(limit) },
      revalidate: 3600,
    });
    return res.data ?? [];
  } catch {
    return [];
  }
}
