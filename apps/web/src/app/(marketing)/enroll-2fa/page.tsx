import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  enrollTotp,
  generateBackupCodes,
  hasVerifiedTotp,
} from "@/lib/auth/mfa";
import { getRoleHome } from "@/lib/auth/role-home";
import { TotpEnrollment } from "@/components/auth/TotpEnrollment";
import { EnrollBackupStep } from "./EnrollBackupStep";
import { verifyEnrollTotp } from "./actions";
import styles from "./EnrollPage.module.css";

export const metadata: Metadata = {
  title: "Set up two-factor authentication",
  description: "Two-factor authentication is required for admin accounts.",
};

type SearchParams = Promise<{ step?: string }>;

export default async function EnrollTwoFactorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { step } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const roleHome = (await getRoleHome()) ?? "/workspace/home";
  const alreadyEnrolled = await hasVerifiedTotp();

  // Backup-codes step: only reachable once the factor is verified. Generate a
  // fresh set here so plaintext is produced server-side and shown exactly once.
  if (step === "backup") {
    if (!alreadyEnrolled) {
      redirect("/enroll-2fa");
    }
    const codes = await generateBackupCodes(user.id);
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <EnrollBackupStep codes={codes} destination={roleHome} />
        </div>
      </div>
    );
  }

  // Enroll step. If a factor is already verified there is nothing to set up.
  if (alreadyEnrolled) {
    redirect(roleHome);
  }

  const enrollment = await enrollTotp();

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.intro}>
          Two-factor authentication is required for admin accounts. Set it up
          once to keep your account secure.
        </p>
        <TotpEnrollment
          factorId={enrollment.factorId}
          qrCode={enrollment.qrCode}
          secret={enrollment.secret}
          verifyAction={verifyEnrollTotp}
          submitLabel="Verify and continue"
        />
      </div>
    </div>
  );
}
