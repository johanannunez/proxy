"use client";

import Image from "next/image";

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        backgroundColor: "#fafafa",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <Image
        src="/brand/logo-mark-v2.png"
        alt="Proxy"
        width={48}
        height={48}
        style={{ marginBottom: "2rem" }}
      />
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "#1a1a1a",
          margin: "0 0 0.5rem",
          letterSpacing: "-0.02em",
        }}
      >
        You&apos;re offline
      </h1>
      <p
        style={{
          fontSize: "0.9375rem",
          color: "#6b7280",
          margin: "0 0 1.5rem",
          textAlign: "center",
        }}
      >
        Check your connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        type="button"
        style={{
          padding: "0.625rem 1.5rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "#ffffff",
          backgroundColor: "#1b77be",
          border: "none",
          borderRadius: "0.5rem",
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}
