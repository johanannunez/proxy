import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Lora } from "next/font/google";
import { AuthLeftPanel } from "@/components/auth/AuthLeftPanel";
import {
  getAssurance,
  listVerifiedFactors,
} from "@/lib/auth/mfa";
import { getRoleHome, safeInternalPath } from "@/lib/auth/role-home";
import { VerifyTotpForm } from "./VerifyTotpForm";

const lora = Lora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verify your identity",
  description: "Enter your authenticator code to finish signing in.",
};

type SearchParams = Promise<{ redirect?: string }>;

export default async function VerifyTwoFactorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { redirect: rawRedirect } = await searchParams;

  const roleHome = await getRoleHome();
  // No logged-in user: nothing to verify, send to login.
  if (!roleHome) {
    redirect("/login");
  }

  const assurance = await getAssurance();
  // Already elevated this session: nothing left to verify. currentLevel comes
  // from the JWT aal claim and is reliable.
  if (assurance.current === "aal2") {
    redirect(roleHome);
  }

  // Authoritative enrollment check. nextLevel is not reliable here, so decide
  // purely on the listed factors (same source the middleware gates on). No
  // verified factor means there is nothing to challenge.
  const factors = await listVerifiedFactors();
  if (factors.length === 0) {
    redirect(roleHome);
  }

  const destination = safeInternalPath(rawRedirect ?? null, roleHome);

  return (
    <div className={`${lora.variable} auth-page-root auth-page-grid`}>
      <div className="auth-left-hide-mobile">
        <AuthLeftPanel />
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-mobile-branding">
            <Image
              src="/brand/logo-mark-v2.png"
              alt="The Proxy"
              width={72}
              height={72}
              style={{
                width: "72px",
                height: "72px",
                objectFit: "contain",
                mixBlendMode: "multiply",
              }}
            />
          </div>

          <h2
            style={{
              fontFamily: "var(--font-lora), Georgia, serif",
              fontSize: "30px",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              textAlign: "center",
              letterSpacing: "-0.02em",
              marginBottom: "8px",
            }}
          >
            Verify your identity
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary)",
              textAlign: "center",
              marginBottom: "24px",
              lineHeight: 1.5,
            }}
          >
            Open your authenticator app and enter the 6-digit code to finish
            signing in.
          </p>

          <VerifyTotpForm factorId={factors[0].id} redirectTo={destination} />
        </div>
      </div>
    </div>
  );
}
