"use client";

import { useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";

type PasswordFieldProps = {
  id: string;
  name: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

export function PasswordField({
  id,
  name,
  autoComplete,
  required,
  minLength,
  placeholder,
  onChange,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={visible ? "Your password" : (placeholder || "••••••••••••")}
        onChange={onChange}
        onFocus={() => { setFocused(true); onFocusProp?.(); }}
        onBlur={() => { setFocused(false); onBlurProp?.(); }}
        style={{
          width: "100%",
          border: `1.5px solid ${focused ? "var(--color-brand)" : "#dce8f0"}`,
          borderRadius: "10px",
          paddingBlock: "10px",
          paddingLeft: "14px",
          paddingRight: "44px",
          fontSize: "14px",
          fontFamily: "inherit",
          color: "#1a1a1a",
          background: focused ? "#ffffff" : "#f7fbfd",
          outline: "none",
          transition: "border-color 0.15s ease, background 0.15s ease",
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={-1}
        style={{
          position: "absolute",
          insetBlock: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#6b7280",
          borderRadius: "0 10px 10px 0",
        }}
      >
        {visible ? (
          <EyeSlash size={17} weight="regular" />
        ) : (
          <Eye size={17} weight="regular" />
        )}
      </button>
    </div>
  );
}
