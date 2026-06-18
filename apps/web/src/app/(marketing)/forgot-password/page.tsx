import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset your Proxy owner workspace password.",
};

type SP = Promise<{ expired?: string }>;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const { expired } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-off-white)] px-6 py-24">
      <div className="w-full max-w-md">
        <h1
          className="mb-2 text-3xl font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Reset your password
        </h1>
        <p
          className="mb-10 text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Enter the email address you signed up with. We will send you a
          secure link to choose a new password.
        </p>

        {expired ? (
          <div
            className="mb-6 rounded-xl border p-4 text-sm"
            role="status"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.10)",
              borderColor: "rgba(245, 158, 11, 0.35)",
              color: "#7c2d12",
            }}
          >
            That reset link has expired or already been used. Request a new
            one below.
          </div>
        ) : null}

        <ForgotPasswordForm />

        <p
          className="mt-8 text-center text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium underline-offset-4 hover:underline"
            style={{ color: "var(--color-brand)" }}
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
