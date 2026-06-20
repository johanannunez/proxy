import type { Icon } from "@phosphor-icons/react";
import {
  Gauge,
  Buildings,
  CurrencyDollar,
  ChartLineUp,
  Pulse,
  ShieldCheck,
  UsersThree,
  Lightbulb,
  Megaphone,
  SlidersHorizontal,
} from "@phosphor-icons/react/dist/ssr";

export type PlatformNavItem = {
  href: string;
  label: string;
  icon: Icon;
  /** Short description shown in the page header / top bar. */
  blurb: string;
  soon?: boolean;
};

export type PlatformNavGroup = {
  label: string | null;
  items: PlatformNavItem[];
};

export const PLATFORM_NAV: PlatformNavGroup[] = [
  {
    label: null,
    items: [
      { href: "/platform", label: "Overview", icon: Gauge, blurb: "The platform's vital signs, on one screen." },
      { href: "/platform/agencies", label: "Agencies", icon: Buildings, blurb: "Every subscriber agency under management." },
      { href: "/platform/revenue", label: "Revenue", icon: CurrencyDollar, blurb: "Agency-operating MRR, reconciled across billing schemas." },
      { href: "/platform/growth", label: "Growth", icon: ChartLineUp, blurb: "Activation funnel, retention, and signups." },
      { href: "/platform/system", label: "System Health", icon: Pulse, blurb: "Integrations, crons, and operational scope." },
      { href: "/platform/support-access", label: "Support Access", icon: ShieldCheck, blurb: "Every time staff entered an agency, logged." },
    ],
  },
  {
    label: "Coming next",
    items: [
      { href: "/platform/waitlist", label: "Waitlist", icon: UsersThree, blurb: "Approve and invite from the public waitlist.", soon: true },
      { href: "/platform/feature-log", label: "Feature Log", icon: Lightbulb, blurb: "Requests from agencies and owners, upvoted.", soon: true },
      { href: "/platform/broadcast", label: "Broadcast", icon: Megaphone, blurb: "Announcements and changelog to every agency.", soon: true },
      { href: "/platform/entitlements", label: "Entitlements", icon: SlidersHorizontal, blurb: "Plan tiers, flags, and comped extensions.", soon: true },
    ],
  },
];

const ALL_ITEMS = PLATFORM_NAV.flatMap((g) => g.items);

/** The nav item whose href best matches the current path (longest prefix). */
export function activeNavItem(pathname: string): PlatformNavItem | undefined {
  const matches = ALL_ITEMS.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return matches.sort((a, b) => b.href.length - a.href.length)[0];
}
