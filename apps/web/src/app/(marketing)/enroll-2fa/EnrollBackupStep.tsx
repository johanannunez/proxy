"use client";

import { useRouter } from "next/navigation";
import { BackupCodesDisplay } from "@/components/auth/BackupCodesDisplay";

interface EnrollBackupStepProps {
  codes: string[];
  /** Where to send the user once they confirm they saved the codes. */
  destination: string;
}

export function EnrollBackupStep({ codes, destination }: EnrollBackupStepProps) {
  const router = useRouter();

  return (
    <BackupCodesDisplay
      codes={codes}
      onConfirm={() => router.replace(destination)}
      title="Save your backup codes"
      subtitle="Each code works once. Store them somewhere safe. If you lose your authenticator, a backup code is the only way back into your account."
      confirmLabel="Finish setup"
    />
  );
}
