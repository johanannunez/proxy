import Image from "next/image";
import Link from "next/link";
import { AuthFeatureRows } from "./AuthFeatureRows";
import { PremiumTestimonials } from "./PremiumTestimonials";

export function AuthLeftPanel() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: "100%",
        padding: "32px 0",
      }}
    >
      {/* Single unified block from logo through proof, centered as one unit */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            marginBottom: "26px",
          }}
        >
          <Image
            src="/brand/logo-mark-v2.png"
            alt="The Proxy"
            width={34}
            height={34}
            style={{
              width: "34px",
              height: "34px",
              objectFit: "contain",
              mixBlendMode: "multiply",
            }}
          />
          <span
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "#1a1a1a",
              letterSpacing: "-0.01em",
            }}
          >
            The Proxy
          </span>
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-lora), Georgia, serif",
            fontSize: "42px",
            fontWeight: 700,
            color: "#1a1a1a",
            lineHeight: 1.06,
            letterSpacing: "-0.025em",
            marginBottom: "10px",
          }}
        >
          Meet Proxy.
        </h1>

        <p
          style={{
            fontSize: "15px",
            color: "#4b5563",
            lineHeight: 1.6,
            maxWidth: "460px",
            marginBottom: "20px",
            fontWeight: 400,
          }}
        >
          Your property in good hands, with every important detail in view.
        </p>

        <AuthFeatureRows />

        <div style={{ marginTop: "18px" }}>
          <PremiumTestimonials />
        </div>
      </div>
    </div>
  );
}
