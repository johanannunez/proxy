"use client";

import { useRef } from "react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import { DatePickerInput } from "@/components/admin/DatePickerInput";
import type { FormField } from "@/lib/admin/forms-types";
import styles from "./FieldRenderer.module.css";

type Props = {
  field: FormField;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: string;
  readOnly?: boolean;
};

export function FieldRenderer({ field, value, onChange, error, readOnly }: Props) {
  const { type, label, required, placeholder, options, ratingMax } = field;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  const strValue = typeof value === "string" ? value : "";
  const numValue = typeof value === "number" ? value : 0;
  const arrValue = Array.isArray(value) ? (value as string[]) : [];

  function labelEl() {
    if (type === "divider" || type === "section_header" || type === "description" || type === "page_break") return null;
    return (
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
    );
  }

  function errorEl() {
    if (!error) return null;
    return <span className={styles.error}>{error}</span>;
  }

  // ── Layout types ──────────────────────────────────────────────────────────
  if (type === "section_header") {
    return <h3 className={styles.sectionHeader}>{label}</h3>;
  }
  if (type === "description") {
    return <p className={styles.description}>{label}</p>;
  }
  if (type === "divider") {
    return <hr className={styles.divider} />;
  }
  // page_break is consumed by FormRenderer before reaching here; render nothing
  // for safety in case a stray instance reaches this component directly.
  if (type === "page_break") {
    return null;
  }

  // ── Signature ─────────────────────────────────────────────────────────────
  if (type === "signature") {
    function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
      if (readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      isDrawingRef.current = true;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      canvas.setPointerCapture(e.pointerId);
    }
    function draw(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!isDrawingRef.current || readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    }
    function endDraw() {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      onChange(canvas.toDataURL("image/png"));
    }
    function clearSig() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      onChange(undefined);
    }

    return (
      <div className={styles.fieldWrap}>
        {labelEl()}
        <div className={`${styles.sigWrap} ${error ? styles.hasError : ""}`}>
          <canvas
            ref={canvasRef}
            className={styles.sigCanvas}
            width={560}
            height={120}
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={endDraw}
            aria-label="Signature canvas"
          />
          {!readOnly && (
            <button type="button" className={styles.clearSigBtn} onClick={clearSig}>
              Clear
            </button>
          )}
        </div>
        {errorEl()}
      </div>
    );
  }

  // ── File upload ───────────────────────────────────────────────────────────
  if (type === "file_upload") {
    const file = value as File | undefined;
    return (
      <div className={styles.fieldWrap}>
        {labelEl()}
        <label className={`${styles.uploadZone} ${error ? styles.hasError : ""}`}>
          <input
            type="file"
            className={styles.hiddenInput}
            disabled={readOnly}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onChange(f);
            }}
          />
          {file ? (
            <span className={styles.uploadFileName}>{file.name}</span>
          ) : (
            <span className={styles.uploadHint}>Click to upload or drag a file here</span>
          )}
        </label>
        {errorEl()}
      </div>
    );
  }

  // ── Rating ────────────────────────────────────────────────────────────────
  if (type === "rating") {
    const max = ratingMax ?? 5;
    return (
      <div className={styles.fieldWrap}>
        {labelEl()}
        <div className={styles.ratingRow} role="group" aria-label={label}>
          {Array.from({ length: max }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.starBtn} ${numValue > i ? styles.starFilled : ""}`}
              onClick={() => !readOnly && onChange(i + 1)}
              aria-label={`${i + 1} star${i + 1 !== 1 ? "s" : ""}`}
              disabled={readOnly}
            >
              ★
            </button>
          ))}
        </div>
        {errorEl()}
      </div>
    );
  }

  // ── Single choice ─────────────────────────────────────────────────────────
  if (type === "single_choice") {
    return (
      <div className={styles.fieldWrap}>
        {labelEl()}
        <div className={styles.choiceList} role="radiogroup" aria-label={label}>
          {(options ?? []).map((opt, i) => (
            <label key={i} className={styles.choiceRow}>
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={strValue === opt}
                onChange={() => onChange(opt)}
                disabled={readOnly}
                className={styles.radioInput}
              />
              <span className={styles.choiceLabel}>{opt}</span>
            </label>
          ))}
        </div>
        {errorEl()}
      </div>
    );
  }

  // ── Multiple choice ───────────────────────────────────────────────────────
  if (type === "multiple_choice") {
    function toggle(opt: string) {
      if (readOnly) return;
      const next = arrValue.includes(opt)
        ? arrValue.filter((v) => v !== opt)
        : [...arrValue, opt];
      onChange(next);
    }
    return (
      <div className={styles.fieldWrap}>
        {labelEl()}
        <div className={styles.choiceList}>
          {(options ?? []).map((opt, i) => (
            <label key={i} className={styles.choiceRow}>
              <input
                type="checkbox"
                value={opt}
                checked={arrValue.includes(opt)}
                onChange={() => toggle(opt)}
                disabled={readOnly}
                className={styles.checkboxInput}
              />
              <span className={styles.choiceLabel}>{opt}</span>
            </label>
          ))}
        </div>
        {errorEl()}
      </div>
    );
  }

  // ── Dropdown ──────────────────────────────────────────────────────────────
  if (type === "dropdown") {
    const selectOptions = (options ?? []).map((o) => ({ value: o, label: o }));
    return (
      <div className={styles.fieldWrap}>
        {labelEl()}
        <CustomSelect
          value={strValue}
          options={selectOptions}
          onChange={(val) => onChange(val)}
          placeholder={placeholder || "Select an option"}
        />
        {errorEl()}
      </div>
    );
  }

  // ── Date ──────────────────────────────────────────────────────────────────
  if (type === "date") {
    return (
      <div className={styles.fieldWrap}>
        {labelEl()}
        <DatePickerInput
          value={strValue}
          onChange={(val) => onChange(val)}
          placeholder={placeholder || "Select a date"}
        />
        {errorEl()}
      </div>
    );
  }

  // ── Long text ─────────────────────────────────────────────────────────────
  if (type === "long_text") {
    return (
      <div className={styles.fieldWrap}>
        {labelEl()}
        <textarea
          className={`${styles.textarea} ${error ? styles.hasError : ""}`}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          disabled={readOnly}
          aria-label={label}
        />
        {errorEl()}
      </div>
    );
  }

  // ── Simple text inputs ────────────────────────────────────────────────────
  const inputType =
    type === "email" ? "email" : type === "phone" ? "tel" : type === "number" ? "number" : "text";

  return (
    <div className={styles.fieldWrap}>
      {labelEl()}
      <input
        type={inputType}
        className={`${styles.input} ${error ? styles.hasError : ""}`}
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={readOnly}
        aria-label={label}
      />
      {errorEl()}
    </div>
  );
}
