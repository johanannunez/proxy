"use client";

import { useState } from "react";
import {
  CheckCircle,
  CircleNotch,
  Image as ImageIcon,
  WarningCircle,
} from "@phosphor-icons/react";
import type { AgencyBranding } from "@/types/agencies";
import { saveBrandingSettings } from "./branding-actions";
import styles from "./BrandingSettings.module.css";

interface BrandingSettingsProps {
  branding: AgencyBranding | null;
  isWhiteLabel: boolean;
}

export function BrandingSettings({ branding, isWhiteLabel }: BrandingSettingsProps) {
  const [logoUrl, setLogoUrl] = useState(branding?.logo_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(branding?.primary_color ?? "#1b77be");
  const [accentColor, setAccentColor] = useState(branding?.accent_color ?? "#02aaeb");
  const [customDomain, setCustomDomain] = useState(branding?.custom_domain ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    const result = await saveBrandingSettings(
      logoUrl.trim() || null,
      primaryColor,
      accentColor,
      isWhiteLabel && customDomain.trim() ? customDomain.trim() : null,
    );

    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } else {
      setError(result.error);
    }
    setSaving(false);
  };

  const logoIsValid = logoUrl.trim().startsWith("http");

  return (
    <div className={styles.wrap}>
      <p className={styles.kicker}>Settings</p>
      <h1 className={styles.title}>Branding</h1>
      <p className={styles.sub}>
        Customize your workspace logo, colors, and domain. Changes apply to client-facing pages and signing forms.
      </p>

      {error && (
        <div className={styles.alertError} role="alert">
          <WarningCircle size={17} weight="fill" />
          {error}
        </div>
      )}

      {saved && (
        <div className={styles.alertSuccess} role="status">
          <CheckCircle size={17} weight="fill" />
          Branding saved successfully.
        </div>
      )}

      {/* Logo */}
      <section className={styles.sectionCard} aria-label="Logo">
        <h2 className={styles.sectionTitle}>Logo</h2>
        <p className={styles.sectionDesc}>
          Paste a publicly accessible image URL. Shown on the client portal, signing forms, and email headers.
        </p>
        <div className={styles.fieldGroup}>
          <div className={styles.field}>
            <label htmlFor="logo-url" className={styles.label}>Logo URL</label>
            <input
              id="logo-url"
              type="url"
              className={styles.input}
              placeholder="https://yourcdn.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>
          <div className={styles.logoPreview}>
            {logoIsValid ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoUrl.trim()}
                alt="Logo preview"
                className={styles.logoImg}
              />
            ) : (
              <div className={styles.logoPlaceholder} aria-label="No logo set">
                <ImageIcon size={18} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Colors */}
      <section className={styles.sectionCard} aria-label="Brand colors">
        <h2 className={styles.sectionTitle}>Brand Colors</h2>
        <p className={styles.sectionDesc}>
          Primary color drives buttons, links, and highlights. Accent color is used for secondary highlights and gradients.
        </p>
        <div className={styles.colorsRow}>
          <div className={styles.colorField}>
            <span className={styles.label}>Primary color</span>
            <div className={styles.colorPickerWrap}>
              <div
                className={styles.colorSwatch}
                style={{ backgroundColor: primaryColor }}
                title="Click to change primary color"
              >
                <input
                  type="color"
                  aria-label="Primary color picker"
                  className={styles.colorInput}
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
              <span className={styles.hexLabel}>{primaryColor.toUpperCase()}</span>
            </div>
          </div>

          <div className={styles.colorField}>
            <span className={styles.label}>Accent color</span>
            <div className={styles.colorPickerWrap}>
              <div
                className={styles.colorSwatch}
                style={{ backgroundColor: accentColor }}
                title="Click to change accent color"
              >
                <input
                  type="color"
                  aria-label="Accent color picker"
                  className={styles.colorInput}
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                />
              </div>
              <span className={styles.hexLabel}>{accentColor.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Custom domain — white_label plan only */}
      {isWhiteLabel && (
        <section className={styles.sectionCard} aria-label="Custom domain">
          <h2 className={styles.sectionTitle}>Custom Domain</h2>
          <p className={styles.sectionDesc}>
            Host the client portal on your own domain. Enter the hostname below, then add a CNAME record with your DNS provider.
          </p>
          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label htmlFor="custom-domain" className={styles.label}>Hostname</label>
              <input
                id="custom-domain"
                type="text"
                className={styles.input}
                placeholder="docs.acme.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
              />
            </div>
            {customDomain.trim() && (
              <p className={styles.dnsNotice}>
                Point a CNAME from{" "}
                <strong>{customDomain.trim()}</strong>{" "}
                to{" "}
                <strong>app.myproxyhost.com</strong>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Save */}
      <div className={styles.saveBar}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <CircleNotch size={15} className={styles.spin} />
          ) : null}
          {saving ? "Saving…" : "Save branding"}
        </button>
      </div>
    </div>
  );
}
