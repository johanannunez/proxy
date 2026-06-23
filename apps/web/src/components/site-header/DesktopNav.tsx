"use client";

import Link from "next/link";
import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { CaretDown, ArrowRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { NavFeatureCard } from "./NavFeatureCard";
import {
  platformItems,
  resourceFeatured,
  resourceLinks,
  pricingLink,
} from "./nav-data";

const triggerCls = cn(
  "group inline-flex h-9 select-none items-center gap-1 rounded-[var(--radius-sm)] px-3 text-[14px] font-medium outline-none",
  "cursor-pointer text-[var(--nav-fg)] transition-colors duration-200",
  "hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-fg-strong)]",
  "data-[popup-open]:bg-[var(--nav-hover-bg)] data-[popup-open]:text-[var(--nav-fg-strong)]",
  "focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand)_55%,transparent)]",
);

const cardLinkCls = cn(
  "group block rounded-[var(--radius-md)] p-2.5 outline-none transition-colors duration-200",
  "hover:bg-[var(--lp-card-hover)]",
  "focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand)_45%,transparent)]",
);

const contentCls = cn(
  "transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
  "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
);

const caretCls =
  "text-[var(--nav-fg)] opacity-70 transition-transform duration-200 group-data-[popup-open]:rotate-180";

export function DesktopNav() {
  return (
    <NavigationMenu.Root delay={120} closeDelay={120} className="hidden lg:block">
      <NavigationMenu.List className="flex items-center gap-0.5">
        {/* Platform */}
        <NavigationMenu.Item>
          <NavigationMenu.Trigger className={triggerCls} data-trigger="platform">
            Platform
            <NavigationMenu.Icon className={caretCls}>
              <CaretDown size={13} weight="bold" />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content className={cn(contentCls, "w-[600px] p-3")} data-flyout="platform">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--lp-ink-mute)]">
              Run your operation
            </p>
            <ul className="grid grid-cols-2 gap-1">
              {platformItems.map((item) => (
                <li key={item.key}>
                  <NavigationMenu.Link render={<Link href={item.href} />} className={cardLinkCls}>
                    <NavFeatureCard feature={item} />
                  </NavigationMenu.Link>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--lp-border)] bg-[var(--lp-surface)] px-3.5 py-2.5">
              <span className="text-[13px] text-[var(--lp-ink-body)]">New to Proxy?</span>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] text-[13px] font-semibold text-[var(--lp-accent-ink)] outline-none transition-opacity duration-200 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand)_45%,transparent)]"
              >
                Book a 15-min walkthrough
                <ArrowRight size={13} weight="bold" />
              </Link>
            </div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        {/* Pricing (flat) */}
        <NavigationMenu.Item>
          <NavigationMenu.Link
            render={<Link href={pricingLink.href} />}
            className={cn(triggerCls, "data-[popup-open]:bg-transparent")}
          >
            {pricingLink.label}
          </NavigationMenu.Link>
        </NavigationMenu.Item>

        {/* Resources */}
        <NavigationMenu.Item>
          <NavigationMenu.Trigger className={triggerCls} data-trigger="resources">
            Resources
            <NavigationMenu.Icon className={caretCls}>
              <CaretDown size={13} weight="bold" />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content className={cn(contentCls, "w-[520px] p-3")} data-flyout="resources">
            <div className="grid grid-cols-2 gap-3">
              <ul className="flex flex-col gap-1">
                {resourceFeatured.map((item) => (
                  <li key={item.key}>
                    <NavigationMenu.Link render={<Link href={item.href} />} className={cardLinkCls}>
                      <NavFeatureCard feature={item} />
                    </NavigationMenu.Link>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-0.5 border-l border-[var(--lp-border)] pl-3">
                {resourceLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <li key={link.href}>
                      <NavigationMenu.Link
                        render={<Link href={link.href} />}
                        className="group flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 outline-none transition-colors duration-200 hover:bg-[var(--lp-card-hover)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand)_45%,transparent)]"
                      >
                        <Icon
                          size={17}
                          weight="duotone"
                          className="text-[var(--lp-ink-mute)] transition-colors duration-200 group-hover:text-[var(--color-brand-light)]"
                        />
                        <span className="text-[13.5px] font-medium text-[var(--lp-ink)]">{link.title}</span>
                      </NavigationMenu.Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner
          side="bottom"
          align="start"
          sideOffset={10}
          collisionPadding={16}
          className="z-[60] outline-none"
        >
          <NavigationMenu.Popup
            className={cn(
              "relative origin-[var(--transform-origin)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--lp-border)] bg-[var(--lp-card)] shadow-[var(--shadow-xl)]",
              "transition-[opacity,transform,width,height] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              "data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0",
            )}
            style={{
              width: "var(--popup-width)",
              height: "var(--popup-height)",
            }}
          >
            <NavigationMenu.Viewport className="relative h-full w-full" />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}
