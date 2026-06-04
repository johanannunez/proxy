import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Lora } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { AuthLeftPanel } from "@/components/auth/AuthLeftPanel";
import { RecoverForm } from "./RecoverForm";

const lora = Lora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recover your account",
  description: "Use a backup code to recover access to your account.",
};

export default async function RecoverTwoFactorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
              color: "#1a1a1a",
              textAlign: "center",
              letterSpacing: "-0.02em",
              marginBottom: "8px",
            }}
          >
            Use a backup code
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "#6b7280",
              textAlign: "center",
              marginBottom: "24px",
              lineHeight: 1.5,
            }}
          >
            Enter one of the backup codes you saved when you set up two-factor
            authentication. We will remove the lost authenticator and help you
            set up a new one.
          </p>

          <RecoverForm />
        </div>
      </div>
    </div>
  );
}
