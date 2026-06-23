import { type NavFeature } from "./nav-data";

/**
 * Presentational capability card (the reference's ListItem). Renders icon tile +
 * title + description as spans so a caller can wrap it in an anchor. Hover styling
 * keys off a `group` class on the wrapping link.
 */
export function NavFeatureCard({ feature }: { feature: NavFeature }) {
  const Icon = feature.icon;
  return (
    <span className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--lp-badge-border)] bg-[var(--lp-badge-bg)] text-[var(--color-brand-light)] transition-colors duration-200 group-hover:border-[color-mix(in_oklab,var(--color-brand-light)_45%,transparent)] group-hover:bg-[color-mix(in_oklab,var(--color-brand-light)_12%,transparent)]">
        <Icon size={20} weight="duotone" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
        <span className="text-[13.5px] font-semibold leading-tight text-[var(--lp-ink)]">
          {feature.title}
        </span>
        <span className="text-[12px] leading-snug text-[var(--lp-ink-mute)]">
          {feature.description}
        </span>
      </span>
    </span>
  );
}
