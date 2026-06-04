import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface FooterProps {
  logo: ReactNode;
  brandName: string;
  socialLinks: Array<{
    icon: ReactNode;
    href: string;
    label: string;
  }>;
  mainLinks: Array<{
    href: string;
    label: string;
  }>;
  legalLinks: Array<{
    href: string;
    label: string;
  }>;
  copyright: {
    text: string;
    license?: string;
  };
}

export function Footer({
  logo,
  brandName,
  socialLinks,
  mainLinks,
  legalLinks,
  copyright,
}: FooterProps) {
  return (
    <footer className="border-t border-[#d9d2c5] bg-[#f8f7f3] pb-6 pt-16 lg:pb-8 lg:pt-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="md:flex md:items-start md:justify-between">
          <Link href="/" className="flex items-center gap-x-3" aria-label={brandName}>
            {logo}
            <span className="text-xl font-semibold tracking-normal text-[#081b33]">
              {brandName}
            </span>
          </Link>
          <ul className="mt-6 flex list-none space-x-3 md:mt-0">
            {socialLinks.map((link) => (
              <li key={link.label}>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                  asChild
                >
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={link.label}
                  >
                    {link.icon}
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6 border-t border-[#d9d2c5] pt-6 md:mt-4 md:pt-8 lg:grid lg:grid-cols-10">
          <nav className="lg:col-[4/11] lg:mt-0" aria-label="Footer navigation">
            <ul className="-mx-2 -my-1 flex list-none flex-wrap lg:justify-end">
              {mainLinks.map((link) => (
                <li key={link.label} className="mx-2 my-1 shrink-0">
                  <a
                    href={link.href}
                    className="text-sm font-medium text-[#081b33] underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-6 lg:col-[4/11] lg:mt-0">
            <ul className="-mx-3 -my-1 flex list-none flex-wrap lg:justify-end">
              {legalLinks.map((link) => (
                <li key={link.label} className="mx-3 my-1 shrink-0">
                  <a
                    href={link.href}
                    className="text-sm text-[#5f7182] underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 text-sm leading-6 text-[#5f7182] lg:col-[1/4] lg:row-[1/3] lg:mt-0">
            <div>{copyright.text}</div>
            {copyright.license ? <div>{copyright.license}</div> : null}
          </div>
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
