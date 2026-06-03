const features = [
  {
    title: "Everything About Your Property",
    desc: "See the setup details, records, documents, and updates Proxy has on file.",
    icon: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  },
  {
    title: "Messages With Context",
    desc: "Keep owner conversations connected to the right property and next step.",
    icon: (
      <>
        <path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
  },
  {
    title: "Know What Needs Attention",
    desc: "See requested items and updates before they become another follow-up.",
    icon: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </>
    ),
  },
  {
    title: "Documents When You Need Them",
    desc: "Find agreements, forms, records, and files without asking for a resend.",
    icon: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </>
    ),
  },
];

const divider = "1px solid rgba(0,0,0,0.07)";

export function AuthFeatureRows() {
  return (
    <div style={{ display: "flex", flexDirection: "column", borderTop: divider }}>
      {features.map((f) => (
        <div
          key={f.title}
          style={{
            borderBottom: divider,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              padding: "10px 0",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                flexShrink: 0,
                marginTop: "2px",
                color: "var(--color-brand)",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {f.icon}
              </svg>
            </div>
            <div>
              <strong
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#1a1a1a",
                  marginBottom: "2px",
                  letterSpacing: "-0.01em",
                }}
              >
                {f.title}
              </strong>
              <span
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  lineHeight: 1.5,
                }}
              >
                {f.desc}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
