import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Mono, Sora, Plus_Jakarta_Sans, Geist } from "next/font/google";
import Script from "next/script";
import ThemeProvider from "@/components/ThemeProvider";
import PostHogProvider from "@/components/PostHogProvider";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const generalSans = localFont({
  src: [
    {
      path: "../fonts/GeneralSans-Variable.ttf",
      style: "normal",
    },
    {
      path: "../fonts/GeneralSans-VariableItalic.ttf",
      style: "italic",
    },
  ],
  variable: "--font-general-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1b77be",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.myproxyhost.com"),
  manifest: "/manifest.json",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
  title: {
    default: "Proxy | Workspace for Short Term Rental Operators",
    template: "Proxy | %s",
  },
  description:
    "A premium workspace for short term rental operators managing owner relationships, documents, financials, messages, tasks, and property readiness.",
  keywords: [
    "short term rental operations",
    "owner relationship management",
    "property operator workspace",
    "property management software",
    "vacation rental operations",
    "operator workspace",
    "rental documents",
    "property financials",
  ],
  authors: [{ name: "Proxy" }],
  creator: "Proxy",
  publisher: "Proxy",
  openGraph: {
    title: "Proxy | Workspace for Short Term Rental Operators",
    description:
      "A premium workspace for operators managing owner relationships, documents, financials, messages, tasks, and property readiness.",
    type: "website",
    locale: "en_US",
    siteName: "Proxy",
  },
  twitter: {
    card: "summary_large_image",
    title: "Proxy | Workspace for Short Term Rental Operators",
    description:
      "Run owner relationships, documents, financials, messages, and property readiness from one premium workspace.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.myproxyhost.com",
    types: {
      "text/plain": "https://www.myproxyhost.com/llms.txt",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Proxy",
    url: "https://www.myproxyhost.com",
    logo: "https://www.myproxyhost.com/brand/proxy-wordmark-navy.png",
    description:
      "A premium workspace for short term rental operators managing owner relationships, documents, financials, messages, tasks, and property readiness.",
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@myproxyhost.com",
      contactType: "customer service",
    },
    sameAs: [],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Proxy",
    url: "https://www.myproxyhost.com",
  };

  const applicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Proxy",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    provider: {
      "@type": "Organization",
      name: "Proxy",
    },
    description:
      "A workspace for short term rental operators managing owner relationships, documents, financials, messages, tasks, and property readiness.",
  };

  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        {/* Kill-switch for stale service worker caches from older versions.
            Runs synchronously before any Next.js chunks are fetched. */}
        <Script src="/sw-killswitch.js" strategy="beforeInteractive" />
        <link
          rel="apple-touch-icon"
          href="/brand/app-icon-light-180.png"
          media="(prefers-color-scheme: light)"
        />
        <link
          rel="apple-touch-icon"
          href="/brand/app-icon-dark-180.png"
          media="(prefers-color-scheme: dark)"
        />
      </head>
      <body className={`${generalSans.variable} ${ibmPlexMono.variable} ${sora.variable} ${plusJakartaSans.variable} antialiased`} suppressHydrationWarning>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: '(function(){try{var o=localStorage.getItem("theme");if(o){localStorage.setItem("proxy-theme",o);localStorage.removeItem("theme")}var t=localStorage.getItem("proxy-theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})();',
          }}
        />
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationSchema, websiteSchema, applicationSchema]),
          }}
        />
        <PostHogProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </PostHogProvider>
        {process.env.NEXT_PUBLIC_GA4_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA4_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
