"use client";

import { useState } from "react";
import { Command } from "@phosphor-icons/react";
import s from "./PersonalInfoSection.module.css";
import x from "./SettingsShared.module.css";

type Theme = "system" | "light" | "dark";

const SHORTCUTS: Array<{ label: string; keys: string[] }> = [
  { label: "Open search",            keys: ["⌘", "K"] },
  { label: "New (contextual)",       keys: ["⌘", "N"] },
  { label: "Jump to Dashboard",      keys: ["G", "D"] },
  { label: "Jump to Owners",         keys: ["G", "O"] },
  { label: "Jump to Inbox",          keys: ["G", "I"] },
  { label: "Toggle dark mode",       keys: ["⌘", "/"] },
  { label: "Show keyboard shortcuts",keys: ["?"] },
];

export function AppPreferencesSection() {
  const [theme, setTheme] = useState<Theme>("system");
  const [compact, setCompact] = useState(false);
  const [animations, setAnimations] = useState(true);
  const [installed, setInstalled] = useState(false);

  return (
    <div>
      <header className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>App preferences</h2>
        <p className={s.sectionSubtitle}>
          Personal app behavior — theme, density, shortcuts.
        </p>
      </header>

      {/* Appearance */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Appearance</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Theme</label>
              <span className={s.labelHint}>Follows system by default.</span>
            </div>
            <div className={s.fieldCell}>
              <div className={s.segmented}>
                {(["system", "light", "dark"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`${s.segmentedBtn} ${
                      theme === t ? s.segmentedBtnActive : ""
                    }`}
                    onClick={() => setTheme(t)}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ToggleRow
            label="Compact density"
            hint="Tighter row heights in lists + tables."
            checked={compact}
            onChange={() => setCompact((v) => !v)}
          />
          <ToggleRow
            label="Interface animations"
            hint="Motion for menus, transitions, tabs."
            checked={animations}
            onChange={() => setAnimations((v) => !v)}
          />
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Keyboard shortcuts</span>
        </div>
        <p className={s.cardHeaderSub}>
          System-wide shortcuts. Navigation shortcuts use a two-key sequence (press G, then the letter).
        </p>
        <ul className={x.shortcutList}>
          {SHORTCUTS.map((sc) => (
            <li key={sc.label} className={x.shortcutItem}>
              <span className={x.shortcutLabel}>{sc.label}</span>
              <span className={x.kbdRow}>
                {sc.keys.map((k, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span className={x.kbd}>{k}</span>
                    {i < sc.keys.length - 1 ? (
                      <span className={x.kbdPlus}>+</span>
                    ) : null}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Install as app */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Install as app</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Standalone window</label>
              <span className={s.labelHint}>
                Install Proxy as its own desktop / mobile app.
              </span>
            </div>
            <div
              className={s.fieldCell}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              {installed ? (
                <>
                  <span className={`${x.pill} ${x.pillGreen}`}>Installed</span>
                  <button
                    type="button"
                    className={s.btnGhost}
                    onClick={() => setInstalled(false)}
                  >
                    Uninstall
                  </button>
                </>
              ) : (
                <>
                  <span className={`${x.pill} ${x.pillSlate}`}>Browser tab</span>
                  <button
                    type="button"
                    className={s.btnSecondary}
                    onClick={() => setInstalled(true)}
                  >
                    <Command size={14} weight="duotone" /> Install Proxy
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className={s.row}>
      <div className={s.labelCell}>
        <label className={s.label}>{label}</label>
        <span className={s.labelHint}>{hint}</span>
      </div>
      <div className={s.fieldCell}>
        <label className={x.switch}>
          <input type="checkbox" checked={checked} onChange={onChange} />
          <span className={x.switchTrack} />
          <span className={x.switchThumb} />
        </label>
      </div>
    </div>
  );
}
