import Image from "next/image";
import Link from "next/link";
import {
  InstagramLogo,
  XLogo,
  LinkedinLogo,
  FacebookLogo,
} from "@phosphor-icons/react/dist/ssr";

const FOOTER_LINKS = {
  Properties: [
    { label: "Vacation Rentals", href: "/properties?type=vacation" },
    { label: "Corporate Stays", href: "/properties?type=corporate" },
    { label: "All Locations", href: "/properties" },
    { label: "Featured", href: "/properties?featured=true" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "List With Us", href: "/list-with-us" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
    { label: "Press", href: "/press" },
  ],
  Support: [
    { label: "Help Center", href: "/help" },
    { label: "Contact", href: "/contact" },
    { label: "Cancellation Policy", href: "/cancellation" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

const SOCIAL_LINKS = [
  { icon: InstagramLogo, href: "#", label: "Instagram" },
  { icon: XLogo, href: "#", label: "X" },
  { icon: LinkedinLogo, href: "#", label: "LinkedIn" },
  { icon: FacebookLogo, href: "#", label: "Facebook" },
];

export default function DarkFooter() {
  return (
    <footer id="contact" aria-label="Site footer" className="bg-navy">
      <div className="mx-auto max-w-[1280px] px-6 pt-16 pb-8 md:px-12 md:pt-20 lg:px-16">
        {/* Top Row */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          {/* Brand Column */}
          <div className="md:col-span-3">
            <Image
              src="/brand/logo-white.png"
              alt="Proxy"
              width={160}
              height={48}
              className="h-10 w-auto brightness-0 invert"
            />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">
              Vacation homes and furnished residences, handpicked for people who
              notice the details.
            </p>

            {/* Social */}
            <div className="mt-6 flex gap-3">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white/70 transition-all duration-300 hover:bg-white/10 hover:text-white"
                >
                  <s.icon size={18} weight="bold" />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title} className="md:col-span-3">
              <h4 className="text-label text-white/80">{title}</h4>
              <ul className="mt-4 space-y-0">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-[44px] items-center text-sm text-white/70 transition-colors duration-300 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mt-12 border-t border-white/10" />

        {/* Bottom Row */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-xs text-white/70">
            &copy; {new Date().getFullYear()} Proxy. All rights
            reserved.
          </p>
          <div className="flex gap-2">
            <Link
              href="/privacy"
              className="inline-flex min-h-[44px] items-center px-2 text-xs text-white/70 transition-colors duration-300 hover:text-white/80"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-[44px] items-center px-2 text-xs text-white/70 transition-colors duration-300 hover:text-white/80"
            >
              Terms
            </Link>
            <Link
              href="/cookies"
              className="inline-flex min-h-[44px] items-center px-2 text-xs text-white/70 transition-colors duration-300 hover:text-white/80"
            >
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
