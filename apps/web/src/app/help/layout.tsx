import type { Metadata } from "next";
import FrostedNav from "@/components/FrostedNav";
import DarkFooter from "@/components/DarkFooter";

export const metadata: Metadata = {
  title: {
    default: "Proxy | Help Center",
    template: "Proxy | %s | Help Center",
  },
  description:
    "Find answers about property management, payouts, calendar, bookings, and your owner workspace at Proxy",
  alternates: { canonical: "https://www.myproxyhost.com/help" },
  openGraph: {
    title: "Proxy | Help Center",
    description:
      "Find answers about property management, payouts, calendar, bookings, and your owner workspace.",
    type: "website",
  },
};

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <FrostedNav />
      {children}
      <DarkFooter />
    </>
  );
}
