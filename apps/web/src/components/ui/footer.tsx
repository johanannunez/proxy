import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import styles from "./footer.module.css";

interface FooterLink {
  href: string;
  label: string;
}

interface FooterActionLink extends FooterLink {
  icon: ReactNode;
}

interface FooterProps {
  logo: ReactNode;
  brandName: string;
  socialLinks?: FooterActionLink[];
  mainLinks?: FooterLink[];
  contactLinks?: FooterLink[];
  legalLinks?: FooterLink[];
  copyright?: {
    text: string;
    license?: string;
  };
  theme?: "light" | "dark";
  defaultMode?: "light" | "dark";
  showModeToggle?: boolean;
}

const DEFAULT_MAIN_LINKS: FooterLink[] = [
  { href: "/#workspace", label: "Workspace" },
  { href: "/#compare", label: "Operators" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#proof", label: "Proof" },
  { href: "/help", label: "Help" },
  { href: "/login", label: "Log in" },
];

const DEFAULT_CONTACT_LINKS: FooterLink[] = [
  { href: "mailto:hello@myproxyhost.com", label: "hello@myproxyhost.com" },
  { href: "https://www.myproxyhost.com", label: "myproxyhost.com" },
  { href: "/signup", label: "Request access for a walkthrough" },
];

const DEFAULT_LEGAL_LINKS: FooterLink[] = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
];

function isInternalHref(href: string) {
  return href.startsWith("/") || href.startsWith("#");
}

function FooterTextLink({
  href,
  label,
  className,
}: FooterLink & { className?: string }) {
  if (isInternalHref(href)) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.column}>
      <h3 className={styles.columnTitle}>{title}</h3>
      {children}
    </div>
  );
}

function SubmitIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.submitIcon}>
      <path
        d="M3.3 9.6 16.1 3.8c.6-.3 1.2.3.9.9l-5.8 12.8c-.3.6-1.1.5-1.3-.1l-1.4-4.1a1.6 1.6 0 0 0-1-1L3.4 11c-.6-.2-.7-1.1-.1-1.4Z"
        fill="currentColor"
      />
      <path
        d="m8.6 11.4 3.4-3.4"
        fill="none"
        stroke="var(--footer-submit-stroke)"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.modeIcon}>
      <circle cx="10" cy="10" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 1.8v2.1M10 16.1v2.1M18.2 10h-2.1M3.9 10H1.8M15.8 4.2l-1.5 1.5M5.7 14.3l-1.5 1.5M15.8 15.8l-1.5-1.5M5.7 5.7 4.2 4.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.modeIcon}>
      <path
        d="M15.9 13.6A6.5 6.5 0 0 1 6.4 4.1a6.9 6.9 0 1 0 9.5 9.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function Footer({
  logo,
  brandName,
  socialLinks = [],
  mainLinks = DEFAULT_MAIN_LINKS,
  contactLinks = DEFAULT_CONTACT_LINKS,
  legalLinks = DEFAULT_LEGAL_LINKS,
  copyright = {
    text: `© ${new Date().getFullYear()} Proxy`,
    license: "All rights reserved",
  },
  theme,
  defaultMode = theme ?? "light",
  showModeToggle = false,
}: FooterProps) {
  return (
    <footer
      className={styles.footer}
      data-default-mode={defaultMode}
      aria-label="Site footer"
    >
      {showModeToggle ? (
        <input
          id="proxy-footer-mode"
          type="checkbox"
          className={styles.modeInput}
          aria-label="Toggle footer color mode"
        />
      ) : null}

      <div className={styles.container}>
        <div className={styles.topRule} />

        <div className={styles.grid}>
          <div className={styles.newsletter}>
            <Link href="/" className={styles.brandLink} aria-label={brandName}>
              <span className={styles.brandLogo}>{logo}</span>
              <span className={styles.brandName}>{brandName}</span>
            </Link>
            <h2 className={styles.newsletterTitle}>Stay connected</h2>
            <p className={styles.newsletterCopy}>
              Get practical updates for running owner relationships from one
              premium workspace.
            </p>
            <form action="/signup" method="get" className={styles.signupForm}>
              <label className="sr-only" htmlFor="footer-email">
                Email address
              </label>
              <input
                id="footer-email"
                name="email"
                type="email"
                placeholder="Enter your email"
                className={styles.emailInput}
              />
              <button type="submit" className={styles.submitButton}>
                <SubmitIcon />
                <span className="sr-only">Request access</span>
              </button>
            </form>
          </div>

          <FooterColumn title="Quick Links">
            <nav aria-label="Footer quick links" className={styles.linkStack}>
              {mainLinks.map((link) => (
                <FooterTextLink
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  label={link.label}
                  className={styles.footerLink}
                />
              ))}
            </nav>
          </FooterColumn>

          <FooterColumn title="Contact Us">
            <address className={styles.contactStack}>
              {contactLinks.map((link) => (
                <FooterTextLink
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  label={link.label}
                  className={styles.footerLink}
                />
              ))}
            </address>
          </FooterColumn>

          <FooterColumn title="Follow Proxy">
            <div className={styles.socialRow}>
              {socialLinks.map((link) => {
                const isInternal = isInternalHref(link.href);

                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target={isInternal || link.href.startsWith("mailto:") ? undefined : "_blank"}
                    rel={isInternal || link.href.startsWith("mailto:") ? undefined : "noreferrer"}
                    aria-label={link.label}
                    className={styles.socialLink}
                  >
                    {link.icon}
                  </a>
                );
              })}
            </div>

            {showModeToggle ? (
              <label htmlFor="proxy-footer-mode" className={styles.modeToggle}>
                <SunIcon />
                <span className={styles.switchTrack}>
                  <span className={styles.switchThumb} />
                </span>
                <MoonIcon />
                <span className="sr-only">Toggle footer color mode</span>
              </label>
            ) : null}
          </FooterColumn>
        </div>

        <div className={styles.bottomRule} />

        <div className={styles.bottomRow}>
          <p className={styles.copyright}>
            {copyright.text}. {copyright.license}
          </p>
          <nav aria-label="Legal links" className={styles.legalNav}>
            {legalLinks.map((link) => (
              <FooterTextLink
                key={`${link.href}-${link.label}`}
                href={link.href}
                label={link.label}
                className={cn(styles.footerLink, styles.legalLink)}
              />
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

export function ProxyFooterLogo() {
  return (
    <Image
      src="/brand/proxy-wordmark-navy.png"
      alt=""
      width={56}
      height={56}
      className="h-10 w-10 object-contain"
    />
  );
}
