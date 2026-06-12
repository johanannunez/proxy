import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupFlow } from "./SignupFlow";

export const metadata: Metadata = {
  title: "Create your workspace | Proxy",
  description:
    "Start free on Proxy: forms, signatures, and a branded client portal for property managers. Set up your company workspace in minutes.",
};

export default function SignupPage() {
  // Billing readiness is decided on the server so the client never needs the
  // secret config. The publishable key is, by definition, public.
  const billing = {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
    proConfigured: Boolean(process.env.STRIPE_PRO_PRICE_ID),
    whiteLabelConfigured: Boolean(process.env.STRIPE_WHITE_LABEL_PRICE_ID),
  };

  return (
    // Suspense boundary: SignupFlow reads useSearchParams (the step lives in
    // the URL), which requires one during prerender.
    <Suspense fallback={null}>
      <SignupFlow billing={billing} />
    </Suspense>
  );
}
