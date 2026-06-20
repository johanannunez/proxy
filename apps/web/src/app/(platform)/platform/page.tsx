/**
 * Platform console — gated shell.
 *
 * This page exists so the super-admin wall (proxy.ts + the platform layout) is
 * reachable and testable end to end. It is deliberately NOT a designed surface:
 * the actual platform tools (agencies directory, agency-operating MRR, growth
 * funnel, support access, system health) are co-designed in M3 under the
 * frontend-design + ui-ux-pro-max skills. Keep this bare until then.
 */
export default function PlatformHomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2rem",
        textAlign: "center",
        backgroundColor: "var(--color-navy)",
        color: "var(--color-white)",
      }}
    >
      <h1 style={{ fontFamily: "var(--font-sora)", fontSize: "1.5rem", fontWeight: 600 }}>
        Proxy Platform Console
      </h1>
      <p style={{ maxWidth: "32rem", opacity: 0.7, lineHeight: 1.6 }}>
        You have super-admin access. The platform surfaces (agencies, revenue,
        growth, support access, system health) land in milestone M3 and will be
        designed before they ship.
      </p>
    </main>
  );
}
