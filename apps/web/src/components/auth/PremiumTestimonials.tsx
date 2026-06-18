import type { CSSProperties, ReactNode } from "react";

const documents = ["Agreement", "W-9", "House guide"];

function PreviewIcon({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span className="auth-preview-icon" style={{ "--preview-icon-color": color } as CSSProperties}>
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </span>
  );
}

export function PremiumTestimonials() {
  return (
    <div className="auth-workspace-preview">
      <div className="auth-workspace-preview-accent" aria-hidden="true" />
      <div className="auth-workspace-preview-glow" aria-hidden="true" />

      <div className="auth-workspace-preview-card">
        <p className="auth-workspace-preview-kicker">Preview your workspace</p>

        <div className="auth-workspace-portal">
          <div className="auth-workspace-portal-header">
            <div className="auth-workspace-portal-title">
              <PreviewIcon color="#0f9f8f">
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M5 9.5V21h14V9.5" />
                <path d="M9 21v-6h6v6" />
              </PreviewIcon>
              <div className="auth-workspace-copy">
                <span className="auth-workspace-name">The Whitmore Family</span>
                <span className="auth-workspace-meta">Workspace</span>
              </div>
            </div>
            <span className="auth-workspace-status">In good hands</span>
          </div>

          <div className="auth-workspace-module-grid">
            <div className="auth-workspace-module auth-workspace-module-meeting">
              <PreviewIcon color="#1b77be">
                <rect x="3" y="4" width="18" height="17" rx="3" />
                <path d="M8 2v4M16 2v4M3 9h18" />
                <path d="M8 14h.01M12 14h.01M16 14h.01" />
              </PreviewIcon>
              <div className="auth-workspace-copy">
                <span className="auth-workspace-label">Upcoming meeting</span>
                <span className="auth-workspace-value">Launch call</span>
                <span className="auth-workspace-detail">Tomorrow at 10:00 AM</span>
              </div>
            </div>

            <div className="auth-workspace-module auth-workspace-module-property">
              <PreviewIcon color="#0f9f8f">
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M5 9.5V21h14V9.5" />
                <path d="M9 21v-6h6v6" />
              </PreviewIcon>
              <div className="auth-workspace-copy">
                <span className="auth-workspace-label">Property</span>
                <span className="auth-workspace-value">Biltmore Estate</span>
                <span className="auth-workspace-detail">Asheville, NC</span>
              </div>
            </div>
          </div>

          <div className="auth-workspace-documents">
            <PreviewIcon color="#155fa0">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <path d="M14 3v6h6M8 13h8M8 17h5" />
            </PreviewIcon>
            <span className="auth-workspace-documents-title">Documents ready</span>
            <span className="auth-workspace-document-list">
              {documents.map((documentName) => (
                <span className="auth-workspace-document-pill" key={documentName}>
                  {documentName}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
