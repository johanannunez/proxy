import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header/SiteHeader";
import DarkFooter from "@/components/DarkFooter";
import RevenueCalculator from "@/components/RevenueCalculator";
import OwnerTestimonials from "@/components/OwnerTestimonials";
import ListWithUsHero from "@/components/ListWithUsHero";
import ListWithUsBenefits from "@/components/ListWithUsBenefits";
import CTASection from "@/components/CTASection";

export const metadata: Metadata = {
  title: "List With Us",
  description:
    "Partner with Proxy to maximize your vacation rental revenue. Professional management, premium guests, and hands-off ownership in the Tri-Cities, WA area.",
  openGraph: {
    title: "Proxy | List Your Property",
    description:
      "See what your property could earn with Proxy. Professional co-hosting and vacation rental management in the Tri-Cities.",
  },
  alternates: {
    canonical: "https://www.myproxyhost.com/list-with-us",
  },
};

export default function ListWithUsPage() {
  return (
    <>
      <SiteHeader overHero />
      <main id="main-content">
        <ListWithUsHero />
        <ListWithUsBenefits />
        <RevenueCalculator />
        <OwnerTestimonials />
        <CTASection />
      </main>
      <DarkFooter />
    </>
  );
}
