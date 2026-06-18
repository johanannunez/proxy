import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-[background-color,color,border-color,opacity] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

function variantStyle(variant: Variant): React.CSSProperties {
  switch (variant) {
    case "primary":
      return {
        backgroundColor: "var(--color-brand)",
        color: "var(--color-white)",
      };
    case "secondary":
      return {
        backgroundColor: "var(--color-white)",
        color: "var(--color-text-primary)",
        border: "1px solid var(--color-warm-gray-200)",
      };
    case "ghost":
      return {
        backgroundColor: "transparent",
        color: "var(--color-text-secondary)",
      };
    case "danger":
      return {
        backgroundColor: "var(--color-white)",
        color: "var(--color-error)",
        border: "1px solid var(--color-warm-gray-200)",
      };
  }
}

export function Button({
  variant = "primary",
  children,
  className = "",
  ...rest
}: { variant?: Variant; children: ReactNode; className?: string } & Omit<
  ComponentProps<"button">,
  "style"
>) {
  return (
    <button
      {...rest}
      className={`${base} hover:opacity-90 ${className}`}
      style={variantStyle(variant)}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  href,
  children,
  className = "",
}: {
  variant?: Variant;
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`${base} hover:opacity-90 ${className}`}
      style={variantStyle(variant)}
    >
      {children}
    </Link>
  );
}
