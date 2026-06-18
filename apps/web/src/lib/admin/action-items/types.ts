export type ActionItemType =
  | "invoice"
  | "risk"
  | "onboarding"
  | "guest"
  | "maintenance"
  | "project"
  | "schedule"
  | "lead"
  | "winback";

export type LaneKey = "money" | "onboarding" | "riskGuests" | "growth";

export type PulseTone = "red" | "amber" | "neutral" | "brand";

export type ActionItem = {
  /** Globally unique across sources: `${type}:${sourceId}`. */
  id: string;
  type: ActionItemType;
  lane: LaneKey;
  /** Human sentence, not a data row. */
  title: string;
  context: string;
  /** ISO timestamp of the hard clock, if any. */
  deadline: string | null;
  /** Actively happening right now. */
  liveNow: boolean;
  /** Dollars (not cents) at stake, if quantifiable. */
  moneyAtRisk: number | null;
  ownerVisible: boolean;
  href: string;
};

export type PulseAtom = {
  key: string;
  label: string;
  value: string;
  tone: PulseTone;
  href: string;
};

export type Lane = {
  key: LaneKey;
  count: number;
  items: ActionItem[];
  worst: ActionItem | null;
};

export type CockpitView = {
  pulse: PulseAtom[];
  hero: ActionItem[];
  heroOverflowCount: number;
  lanes: Lane[];
};

export const LANE_ORDER: LaneKey[] = ["money", "onboarding", "riskGuests", "growth"];

export const LANE_LABELS: Record<LaneKey, string> = {
  money: "Money",
  onboarding: "Onboarding",
  riskGuests: "Risk & Guests",
  growth: "Growth",
};
