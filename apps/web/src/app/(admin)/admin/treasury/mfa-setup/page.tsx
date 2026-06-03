import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MfaSetupForm } from "./MfaSetupForm";

export const metadata: Metadata = {
  title: "Set Up MFA | Treasury",
};

export default async function MfaSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify admin role before allowing MFA enrollment
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/workspace/home");
  }

  // If user already has TOTP enrolled, skip setup
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verifiedTotpFactors = (factors?.totp ?? []).filter(
    (f) => f.status === "verified",
  );

  if (verifiedTotpFactors.length > 0) {
    redirect("/admin/treasury/verify");
  }

  // Enroll TOTP factor server-side so the secret never travels through
  // an extra client-initiated server action RPC call.
  const { data: enrollData, error: enrollError } =
    await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Treasury TOTP",
    });

  if (enrollError || !enrollData) {
    // Enrollment failed. Show the form in error state.
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          backgroundColor: "var(--color-warm-gray-50)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            backgroundColor: "var(--color-off-white)",
            borderRadius: "16px",
            border: "1.5px solid var(--color-warm-gray-200)",
            padding: "40px 36px",
            boxShadow:
              "0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -1px rgba(0,0,0,0.04)",
          }}
        >
          <MfaSetupForm
            enrollment={null}
            enrollError={enrollError?.message ?? "Failed to set up MFA. Please try again."}
          />
        </div>
      </div>
    );
  }

  // Audit log the enrollment start (fire-and-forget)
  const svc = createServiceClient();
  svc
    .from("treasury_audit_log")
    .insert({
      action: "mfa_enroll",
      resource_type: "treasury",
      resource_id: null,
      user_id: user.id,
      metadata: {
        description: "Treasury MFA TOTP enrollment started",
        factor_id: enrollData.id,
      },
    })
    .then(() => {}, () => {});

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        backgroundColor: "var(--color-warm-gray-50)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "var(--color-off-white)",
          borderRadius: "16px",
          border: "1.5px solid var(--color-warm-gray-200)",
          padding: "40px 36px",
          boxShadow:
            "0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -1px rgba(0,0,0,0.04)",
        }}
      >
        <MfaSetupForm
          enrollment={{
            factorId: enrollData.id,
            qrCode: enrollData.totp.qr_code,
            secret: enrollData.totp.secret,
          }}
          enrollError={null}
        />
      </div>
    </div>
  );
}
