import type { ImageSource } from "../actions";

/**
 * Shape passed from the server page down into every client component.
 * Computed once on the server so image URLs never touch the client bundle.
 */
export type PropertyRowData = {
  id: string;
  /** address_line1 — the primary address identifier in portal UI */
  address: string;
  city: string;
  state: string;
  postalCode: string;
  homeType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  sqft: number | null;
  active: boolean;
  imageSource: ImageSource;
  coverPhotoUrl: string | null;
  /** Google Maps Static satellite URL, null when API key absent */
  aerialUrl: string | null;
  /** Google Maps Static Street View URL, null when API key absent */
  streetUrl: string | null;
  /** False for addresses confirmed to have no Google Street View imagery */
  streetViewAvailable: boolean;
};
