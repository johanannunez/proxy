export const SETTINGS_SECTIONS = [
  "personal",
  "account",
  "business",
  "notifications",
  "payments",
  "property_defaults",
  "region",
  "preferences",
  "privacy",
  "danger",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
