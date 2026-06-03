import Link from "next/link";
import { Buildings } from "@phosphor-icons/react/dist/ssr";

export default function PropertyNotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border px-8 py-16 text-center"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: "var(--color-warm-gray-100)",
          color: "var(--color-text-primary)",
        }}
      >
        <Buildings size={26} weight="duotone" />
      </span>
      <h2
        className="mt-5 text-lg font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        We could not find that property.
      </h2>
      <p
        className="mt-2 max-w-md text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        It may have been removed, or you may not have access. Head back to the
        portfolio to see what is available.
      </p>
      <Link
        href="/workspace/properties"
        className="mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--color-brand)" }}
      >
        Back to properties
      </Link>
    </div>
  );
}
