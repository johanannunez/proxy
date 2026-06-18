'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { updateEmail, updatePassword } from '../actions';

function Feedback({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state) return null;

  if (!state.ok) {
    return (
      <div
        className="rounded-lg border px-4 py-3 text-sm font-medium"
        style={{
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          borderColor: 'rgba(220, 38, 38, 0.25)',
          color: 'var(--color-error, #dc2626)',
        }}
      >
        {state.message}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm font-medium"
      style={{
        backgroundColor: 'rgba(22, 163, 74, 0.08)',
        borderColor: 'rgba(22, 163, 74, 0.25)',
        color: 'var(--color-success, #16a34a)',
      }}
    >
      {state.message}
    </div>
  );
}

function PasswordInput({
  name,
  placeholder,
  minLength,
}: {
  name: string;
  placeholder: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        name={name}
        placeholder={placeholder}
        minLength={minLength}
        required
        className="w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors"
        style={{
          borderColor: 'var(--color-warm-gray-200)',
          color: 'var(--color-text-primary, #1a1a1a)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-brand, #1b77be)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-warm-gray-200)';
        }}
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? (
          <EyeSlash
            size={18}
            style={{ color: 'var(--color-text-tertiary, #767170)' }}
          />
        ) : (
          <Eye
            size={18}
            style={{ color: 'var(--color-text-tertiary, #767170)' }}
          />
        )}
      </button>
    </div>
  );
}

export default function SecuritySection({ userEmail }: { userEmail: string }) {
  const [emailState, emailAction, emailPending] = useActionState(updateEmail, null);
  const [passwordState, passwordAction, passwordPending] = useActionState(updatePassword, null);

  return (
    <section id="security" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: 'var(--color-text-primary, #1a1a1a)' }}
      >
        Email &amp; Password
      </h2>
      <p
        className="mt-1 text-sm"
        style={{ color: 'var(--color-text-secondary, #6b7280)' }}
      >
        Manage your login credentials and keep your account secure.
      </p>

      <div
        className="mt-5 overflow-hidden rounded-xl border"
        style={{
          borderColor: 'var(--color-warm-gray-200)',
          backgroundColor: 'var(--color-white, #ffffff)',
        }}
      >
        {/* Email address */}
        <form action={emailAction}>
          <div
            className="border-b p-6"
            style={{ borderColor: 'var(--color-warm-gray-200)' }}
          >
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary, #1a1a1a)' }}
            >
              Email address
            </h3>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-text-secondary, #6b7280)' }}
            >
              Currently signed in as{' '}
              <span
                className="font-medium"
                style={{ color: 'var(--color-text-primary, #1a1a1a)' }}
              >
                {userEmail}
              </span>
            </p>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="new-email"
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--color-text-primary, #1a1a1a)' }}
                >
                  New email
                </label>
                <input
                  id="new-email"
                  type="email"
                  name="new_email"
                  placeholder="Enter new email address"
                  required
                  className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    borderColor: 'var(--color-warm-gray-200)',
                    color: 'var(--color-text-primary, #1a1a1a)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-brand, #1b77be)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-warm-gray-200)';
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={emailPending}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-brand, #1b77be)' }}
              >
                {emailPending ? 'Updating...' : 'Update email'}
              </button>
            </div>

            <div className="mt-3">
              <Feedback state={emailState} />
            </div>
          </div>
        </form>

        {/* Change password */}
        <form action={passwordAction}>
          <div className="p-6">
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary, #1a1a1a)' }}
            >
              Change password
            </h3>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-text-secondary, #6b7280)' }}
            >
              Use a strong password with at least 8 characters.
            </p>

            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label
                  htmlFor="current-password"
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--color-text-primary, #1a1a1a)' }}
                >
                  Current password
                </label>
                <PasswordInput
                  name="current_password"
                  placeholder="Enter current password"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: 'var(--color-text-primary, #1a1a1a)' }}
                  >
                    New password
                  </label>
                  <PasswordInput
                    name="new_password"
                    placeholder="Min. 8 characters"
                    minLength={8}
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: 'var(--color-text-primary, #1a1a1a)' }}
                  >
                    Confirm new password
                  </label>
                  <PasswordInput
                    name="confirm_password"
                    placeholder="Re-enter new password"
                    minLength={8}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={passwordPending}
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--color-brand, #1b77be)' }}
                >
                  {passwordPending ? 'Updating...' : 'Update password'}
                </button>
              </div>

              <Feedback state={passwordState} />
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
