import type { Metadata } from "next";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata: Metadata = {
  title: "Get started | Proxy",
};

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
