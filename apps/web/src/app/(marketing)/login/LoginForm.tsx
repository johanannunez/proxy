"use client";

import { useActionState } from "react";
import { PasswordField } from "@/components/auth/PasswordField";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  border: "1.5px solid #dce8f0",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "14px",
  fontFamily: "inherit",
  color: "#1a1a1a",
  background: "#f7fbfd",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "#6b7280",
};

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  // If the user was sent here from a protected page, honor that destination.
  // Otherwise the login action routes admins to admin and owners to the portal.
  const effectiveRedirect = redirectTo;

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <input type="hidden" name="redirect" value={effectiveRedirect} />

      <div style={{ marginBottom: "12px" }}>
        <div style={{ marginBottom: "6px" }}>
          <label htmlFor="email" style={labelStyle}>
            Email
          </label>
        </div>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          style={fieldInputStyle}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--color-brand)";
            e.target.style.background = "#ffffff";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#dce8f0";
            e.target.style.background = "#f7fbfd";
          }}
        />
      </div>

      <div style={{ marginBottom: "14px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "6px",
          }}
        >
          <label htmlFor="password" style={labelStyle}>
            Password
          </label>
          <a
            href="/forgot-password"
            style={{
              fontSize: "12px",
              color: "var(--color-brand)",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Forgot password?
          </a>
        </div>
        <PasswordField
          id="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="Password"
        />
      </div>

      {state.error ? (
        <p
          style={{ fontSize: "13px", color: "var(--color-error)", marginBottom: "8px" }}
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        style={{
          width: "100%",
          background:
            "linear-gradient(135deg, #02aaeb 0%, #1b77be 60%, #155fa0 100%)",
          color: "white",
          border: "none",
          borderRadius: "10px",
          padding: "12px",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: pending ? "not-allowed" : "pointer",
          marginTop: "16px",
          letterSpacing: "-0.01em",
          boxShadow: "0 4px 16px rgba(27,119,190,0.28)",
          opacity: pending ? 0.65 : 1,
          transition: "opacity 0.15s ease",
        }}
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
