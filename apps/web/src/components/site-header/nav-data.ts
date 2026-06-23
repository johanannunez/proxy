import {
  type Icon,
  Buildings,
  FileText,
  UsersThree,
  Receipt,
  FunnelSimple,
  Lightning,
  Quotes,
  Article,
  Lifebuoy,
  Compass,
  Briefcase,
  Newspaper,
} from "@phosphor-icons/react";

export type NavFeature = {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: Icon;
};

export type NavLink = {
  title: string;
  href: string;
  icon: Icon;
};

/**
 * Platform flyout: what operators run on Proxy. Each card maps to a real
 * product surface.
 *
 * TODO(platform-pages): all cards point at the homepage workspace showcase
 * (`/#workspace`) until dedicated per-capability feature pages exist. Swap each
 * href to its own page/anchor when those are built.
 */
export const platformItems: NavFeature[] = [
  {
    key: "listings",
    title: "Listings & Channels",
    description: "Sync and manage every listing across channels.",
    href: "/#workspace",
    icon: Buildings,
  },
  {
    key: "documents",
    title: "Documents & e-sign",
    description: "Agreements, W-9s, templates, and signatures.",
    href: "/#workspace",
    icon: FileText,
  },
  {
    key: "owner-portal",
    title: "Owner Portal",
    description: "Statements and updates owners actually open.",
    href: "/#workspace",
    icon: UsersThree,
  },
  {
    key: "billing",
    title: "Billing & Payouts",
    description: "Invoicing, splits, and on-time payouts.",
    href: "/#workspace",
    icon: Receipt,
  },
  {
    key: "lead-pipeline",
    title: "Lead Pipeline",
    description: "Onboard new owners and properties faster.",
    href: "/#workspace",
    icon: FunnelSimple,
  },
  {
    key: "today",
    title: "Today & Automation",
    description: "A triage cockpit that clears the busywork.",
    href: "/#workspace",
    icon: Lightning,
  },
];

/** Resources flyout: two featured cards on the left. */
export const resourceFeatured: NavFeature[] = [
  {
    key: "customers",
    title: "Customers",
    description: "How operators grow their portfolios on Proxy.",
    href: "/#proof",
    icon: Quotes,
  },
  {
    key: "journal",
    title: "Journal",
    description: "Playbooks and notes from the field.",
    href: "/blog",
    icon: Article,
  },
];

/** Resources flyout: plain links on the right. */
export const resourceLinks: NavLink[] = [
  { title: "Help center", href: "/help", icon: Lifebuoy },
  { title: "About", href: "/about", icon: Compass },
  { title: "Careers", href: "/careers", icon: Briefcase },
  { title: "Press", href: "/press", icon: Newspaper },
];

/** Flat link rendered between the two flyout triggers. */
export const pricingLink = { label: "Pricing", href: "/pricing" } as const;

export const ctaLinks = {
  signIn: { label: "Sign in", href: "/login" },
  getStarted: { label: "Get started", href: "/signup" },
  browseStays: { label: "Browse stays", href: "/properties" },
} as const;
