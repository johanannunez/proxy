import FrostedNav from "@/components/FrostedNav";
import HeroBookingBar from "@/components/HeroBookingBar";
import TrustedPlatforms from "@/components/TrustedPlatforms";
import PropertiesSection from "@/components/PropertiesSection";
import CategoriesSection from "@/components/CategoriesSection";
import StatsSection from "@/components/StatsSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import JournalSection from "@/components/JournalSection";
import OwnerTestimonials from "@/components/OwnerTestimonials";
import CTASection from "@/components/CTASection";
import DarkFooter from "@/components/DarkFooter";

export default function Home() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <FrostedNav />
      <main id="main-content">
        <HeroBookingBar />
        <TrustedPlatforms />
        <PropertiesSection />
        <CategoriesSection />
        <StatsSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <JournalSection />
        <OwnerTestimonials />
        <CTASection />
      </main>
      <DarkFooter />
    </>
  );
}
