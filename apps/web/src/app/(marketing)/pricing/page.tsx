import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ProxyPricing } from "@/components/ProxyPricing";
import { Footer, ProxyFooterLogo } from "@/components/ui/footer";
import { ChatCircle, ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing | Proxy",
  description: "Simple, transparent pricing for property management operators. One workspace for your entire portfolio.",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f3]">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-[#d9d2c5]/70 bg-[#f8f7f3]/90 backdrop-blur-xl">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10"
        >
          <Link href="/" aria-label="Proxy home" className="flex items-center">
            <Image
              src="/brand/proxy-wordmark-navy.png"
              alt="Proxy"
              width={160}
              height={160}
              priority
              className="h-11 w-11 object-contain"
            />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link href="/#workspace" className="text-sm font-medium text-[#294157] transition-colors duration-200 hover:text-[#1b77be]">
              Workspace
            </Link>
            <Link href="/#operators" className="text-sm font-medium text-[#294157] transition-colors duration-200 hover:text-[#1b77be]">
              Operators
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-[#1b77be]">
              Pricing
            </Link>
            <Link href="/#proof" className="text-sm font-medium text-[#294157] transition-colors duration-200 hover:text-[#1b77be]">
              Proof
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-semibold text-[#294157] transition-colors duration-200 hover:text-[#1b77be] sm:inline-flex"
            >
              Log in
            </Link>
            <Button asChild className="shadow-[0_12px_30px_rgba(8,27,51,0.16)]">
              <Link href="/signup">
                Request access
                <ArrowRight size={16} weight="bold" />
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      <ProxyPricing />

      <Footer
        logo={<ProxyFooterLogo />}
        brandName="Proxy"
        socialLinks={[
          {
            icon: <ChatCircle size={18} weight="duotone" />,
            href: "mailto:hello@myproxyhost.com",
            label: "Email Proxy",
          },
          {
            icon: <ChartLineUp size={18} weight="duotone" />,
            href: "https://www.myproxyhost.com",
            label: "Proxy website",
          },
        ]}
        mainLinks={[
          { href: "/", label: "Home" },
          { href: "/pricing", label: "Pricing" },
          { href: "/help", label: "Help" },
          { href: "/login", label: "Log in" },
        ]}
        legalLinks={[
          { href: "/privacy", label: "Privacy" },
          { href: "/terms", label: "Terms" },
          { href: "/cookies", label: "Cookies" },
        ]}
        copyright={{
          text: `© ${new Date().getFullYear()} Proxy`,
          license: "All rights reserved",
        }}
      />
    </main>
  );
}
