"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Crop,
  DotsThree,
  PaperPlaneTilt,
  PencilSimple,
  SpinnerGap,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import type {
  Form,
  FormCoverBackground,
  FormCoverMode,
  FormCoverSettings,
} from "@/lib/admin/forms-types";
import {
  FORM_COVER_COLORS,
  FORM_STOCK_COVERS,
  FORM_CARD_TITLE_MAX,
  buildFormCoverMockup,
  formCardQuestionLabel,
  formCardResponseLabel,
  formCardSummary,
  limitFormCardText,
  resolveFormCover,
  suggestStockCovers,
  type FormStockCover,
} from "@/lib/admin/form-cover";
import { fmtShortDate } from "@/lib/admin/documents-hub-shared";
import { FormGlyph, resolveFormAppearance } from "./form-icon";
import {
  removeFormCoverAction,
  updateFormCoverAction,
  uploadFormCoverAction,
} from "../templates/form-actions";
import styles from "./FormCoverEditor.module.css";

const COVER_WIDTH = 1600;
const COVER_HEIGHT = 900;
const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

type CoverTab = "smart" | "stock" | "upload";

const COVER_TABS: Array<{ tab: CoverTab; label: string }> = [
  { tab: "smart", label: "Smart" },
  { tab: "stock", label: "Stock" },
  { tab: "upload", label: "Upload" },
];

const SMART_BACKGROUNDS: Array<{
  value: FormCoverBackground;
  label: string;
  tone: string;
}> = [
  { value: "minimal", label: "Minimal", tone: "Quiet" },
  { value: "paper", label: "Paper", tone: "Soft" },
  { value: "wash", label: "Wash", tone: "Airy" },
  { value: "mesh", label: "Mesh", tone: "Bold" },
];

type CoverDraft = {
  file: File;
  url: string;
  zoom: number;
  x: number;
  y: number;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not prepare the cover image."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      0.88,
    );
  });
}

async function cropCoverImage(draft: CoverDraft): Promise<File> {
  const image = await loadImage(draft.file);
  const canvas = document.createElement("canvas");
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the cover image.");

  context.fillStyle = "#f8f7f6";
  context.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);

  const baseScale = Math.max(
    COVER_WIDTH / image.naturalWidth,
    COVER_HEIGHT / image.naturalHeight,
  );
  const scale = baseScale * draft.zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = (COVER_WIDTH - drawWidth) * (draft.x / 100);
  const drawY = (COVER_HEIGHT - drawHeight) * (draft.y / 100);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  const blob = await canvasToBlob(canvas);
  return new File([blob], "form-cover.webp", { type: "image/webp" });
}

function stockCoverOrder(form: Form): FormStockCover[] {
  const suggested = suggestStockCovers(form, 4);
  const suggestedIds = new Set(suggested.map((cover) => cover.id));
  return [
    ...suggested,
    ...FORM_STOCK_COVERS.filter((cover) => !suggestedIds.has(cover.id)),
  ];
}

function coverModeLabel(mode: FormCoverMode): string {
  if (mode === "stock") return "Stock cover";
  if (mode === "upload") return "Uploaded cover";
  if (mode === "color") return "Smart cover";
  return "Smart cover";
}

function coverTabForMode(mode: FormCoverMode): CoverTab {
  if (mode === "stock") return "stock";
  if (mode === "upload") return "upload";
  return "smart";
}

function generatedBackgroundClass(background: FormCoverBackground): string {
  if (background === "mesh") return styles.generatedCoverMesh;
  if (background === "wash") return styles.generatedCoverWash;
  if (background === "minimal") return styles.generatedCoverMinimal;
  return styles.generatedCoverPaper;
}

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function FormCoverEditor({
  form,
  responseCount = 0,
}: {
  form: Form;
  responseCount?: number;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftUrlRef = useRef<string | null>(null);
  const [draft, setDraft] = useState<CoverDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cover = resolveFormCover(form);
  const appearance = resolveFormAppearance({
    id: form.id,
    icon: form.icon,
    icon_color: form.icon_color,
  });
  const orderedStockCovers = useMemo(() => stockCoverOrder(form), [form]);
  const suggestedStockCovers = useMemo(() => suggestStockCovers(form, 4), [form]);
  const mockup = useMemo(() => buildFormCoverMockup(form), [form]);
  const questionCount = form.schema.fields.length;
  const displayName = limitFormCardText(form.name, FORM_CARD_TITLE_MAX);
  const summary = formCardSummary(form);
  const responseText = formCardResponseLabel(responseCount);
  const noResponses = responseCount === 0;
  const timelineLabel = `Updated ${fmtShortDate(form.updated_at)}`;
  const statusLabel = form.is_active ? "Live" : "Draft";
  const suggestedIds = useMemo(
    () => new Set(suggestedStockCovers.map((stockCover) => stockCover.id)),
    [suggestedStockCovers],
  );
  const [activeTab, setActiveTab] = useState<CoverTab>(coverTabForMode(cover.mode));
  const [hexValue, setHexValue] = useState(cover.color ?? appearance.fg);
  const [blurCover, setBlurCover] = useState(cover.blur);
  const [showIcon, setShowIcon] = useState(cover.showIcon);
  const [background, setBackground] = useState<FormCoverBackground>(cover.background);

  useEffect(() => {
    setActiveTab(coverTabForMode(cover.mode));
    setHexValue(cover.color ?? appearance.fg);
    setBlurCover(cover.blur);
    setShowIcon(cover.showIcon);
    setBackground(cover.background);
  }, [
    appearance.fg,
    cover.background,
    cover.blur,
    cover.color,
    cover.mode,
    cover.showIcon,
  ]);

  useEffect(() => {
    return () => {
      if (draftUrlRef.current) URL.revokeObjectURL(draftUrlRef.current);
    };
  }, []);

  function clearDraft() {
    if (draftUrlRef.current) {
      URL.revokeObjectURL(draftUrlRef.current);
      draftUrlRef.current = null;
    }
    setDraft(null);
  }

  function updateDraft(patch: Partial<Pick<CoverDraft, "zoom" | "x" | "y">>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function persistCover(nextCover: FormCoverSettings) {
    setError(null);
    startTransition(async () => {
      const result = await updateFormCoverAction(form.id, nextCover);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      setError("Choose an image under 12MB.");
      return;
    }

    clearDraft();
    setError(null);
    const url = URL.createObjectURL(file);
    draftUrlRef.current = url;
    setDraft({ file, url, zoom: 1, x: 50, y: 50 });
  }

  function handleSaveUpload() {
    if (!draft) return;
    const activeDraft = draft;
    setError(null);
    startTransition(async () => {
      try {
        const cropped = await cropCoverImage(activeDraft);
        const formData = new FormData();
        formData.set("cover", cropped);
        const result = await uploadFormCoverAction(form.id, formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        clearDraft();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cover image could not be saved.");
      }
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeFormCoverAction(form.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function applySmartCover(options?: {
    color?: string;
    blur?: boolean;
    showIcon?: boolean;
    background?: FormCoverBackground;
  }) {
    const nextColor = options?.color ?? hexValue;
    const nextBlur = options?.blur ?? blurCover;
    const nextShowIcon = options?.showIcon ?? showIcon;
    const nextBackground = options?.background ?? background;
    const normalized = normalizeHex(nextColor);
    if (!HEX_PATTERN.test(normalized)) {
      setError("Enter a valid 6 digit hex color.");
      return;
    }
    setHexValue(normalized);
    setBlurCover(nextBlur);
    setShowIcon(nextShowIcon);
    setBackground(nextBackground);
    persistCover({
      mode: "color",
      color: normalized,
      blur: nextBlur,
      showIcon: nextShowIcon,
      background: nextBackground,
    });
  }

  const previewingSmart = activeTab === "smart";
  const previewImageUrl = previewingSmart ? null : cover.imageUrl;
  const previewColor = previewingSmart ? hexValue : cover.color ?? hexValue;
  const previewBlur = previewingSmart ? blurCover : cover.blur;
  const previewShowIcon = previewingSmart ? showIcon : cover.showIcon;
  const previewBackground = previewingSmart ? background : cover.background;
  const generatedCoverClass = [
    styles.generatedCover,
    generatedBackgroundClass(previewBackground),
    previewBlur ? styles.generatedCoverBlurred : "",
    previewShowIcon ? "" : styles.generatedCoverNoIcon,
  ]
    .filter(Boolean)
    .join(" ");

  const previewStyle = {
    "--cover-tone": appearance.fg,
    "--cover-surface": appearance.bg,
    "--cover-color": previewColor,
  } as CSSProperties;

  return (
    <section id="cover" className={styles.card} aria-label="Cover image">
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Cover image</h3>
          <p className={styles.sub}>Set the library card art and respondent header.</p>
        </div>
        <span className={styles.modeBadge}>{coverModeLabel(cover.mode)}</span>
      </div>

      <div className={styles.coverGrid}>
        <div className={styles.cardPreviewMockup} style={previewStyle}>
          <div className={styles.mockupCoverWindow}>
            <span
              className={`${styles.mockupStatus} ${
                form.is_active ? styles.mockupStatusLive : styles.mockupStatusDraft
              }`}
            >
              {statusLabel}
            </span>
            {previewImageUrl ? (
              <>
                <img src={previewImageUrl} alt={cover.alt} className={styles.coverImage} />
                <span className={styles.coverImageScrim} aria-hidden />
                {previewShowIcon && (
                  <span className={styles.mockupCoverGlyph} aria-hidden>
                    <FormGlyph appearance={appearance} size={22} />
                  </span>
                )}
              </>
            ) : (
              <div className={generatedCoverClass} aria-hidden>
                <span className={styles.generatedSheet}>
                  <span className={styles.generatedMockupHeader}>
                    {previewShowIcon && (
                      <span className={styles.generatedIcon}>
                        <FormGlyph appearance={appearance} size={16} />
                      </span>
                    )}
                    <strong>{mockup.title}</strong>
                  </span>
                  <span className={styles.generatedMockupFields}>
                    {mockup.fields.slice(0, 2).map((field, index) => (
                      <span key={`${field}-${index}`}>{field}</span>
                    ))}
                  </span>
                  <span className={styles.generatedMockupSubmit}>
                    {mockup.buttonText}
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className={styles.mockupCardBody}>
            <div className={styles.mockupTitleRow}>
              <strong>{displayName}</strong>
            </div>
            <p className={styles.mockupDescription}>{summary}</p>
            <div className={styles.mockupMetrics}>
              <span className={styles.mockupStatsLine}>
                <span className={styles.mockupMetric}>
                  {formCardQuestionLabel(questionCount)}
                </span>
                <span
                  className={`${styles.mockupMetric} ${
                    noResponses ? styles.mockupMetricEmpty : ""
                  }`}
                >
                  {responseText}
                </span>
              </span>
              <span className={styles.mockupUpdated}>{timelineLabel}</span>
            </div>
          </div>

          <div className={styles.mockupFooter}>
            <span className={styles.mockupEditIcon}>
              <PencilSimple size={12} weight="bold" />
            </span>
            <span className={styles.mockupPrimaryAction}>
              <PaperPlaneTilt size={12} weight="bold" />
              Send form
            </span>
            <span className={styles.mockupMoreIcon}>
              <DotsThree size={16} weight="bold" />
            </span>
          </div>
        </div>

        <div className={styles.controlsPanel}>
          <div className={styles.tabs} role="tablist" aria-label="Cover options">
            {COVER_TABS.map((tab) => (
              <button
                key={tab.tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.tab}
                className={`${styles.tab} ${activeTab === tab.tab ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(tab.tab)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.panel}>
            {activeTab === "smart" && (
              <div className={styles.smartPanel}>
                <div className={styles.minimalHeader}>
                  <div>
                    <span className={styles.panelKicker}>Smart</span>
                    <strong>Cover studio</strong>
                  </div>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => applySmartCover()}
                    disabled={pending}
                  >
                    {pending ? <SpinnerGap size={14} weight="bold" className={styles.spinner} /> : <Check size={14} weight="bold" />}
                    Save
                  </button>
                </div>

                <div className={styles.styleGrid} aria-label="Smart cover style">
                  {SMART_BACKGROUNDS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.styleCard} ${
                        background === option.value ? styles.styleCardActive : ""
                      }`}
                      onClick={() => applySmartCover({ background: option.value })}
                      disabled={pending}
                      aria-pressed={background === option.value}
                    >
                      <span
                        className={styles.stylePreview}
                        data-style={option.value}
                        aria-hidden
                      >
                        <span />
                      </span>
                      <span className={styles.styleCopy}>
                        <strong>{option.label}</strong>
                        <span>{option.tone}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className={styles.accentPanel}>
                  <span className={styles.panelKicker}>Accent</span>
                  <div className={styles.colorSwatches}>
                    {FORM_COVER_COLORS.map((option) => {
                      const active = hexValue.toLowerCase() === option.value.toLowerCase();
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`${styles.colorSwatch} ${active ? styles.colorSwatchActive : ""}`}
                          style={{ "--swatch": option.value } as CSSProperties}
                          onClick={() => applySmartCover({ color: option.value })}
                          aria-label={`Use ${option.label} cover color`}
                          title={option.label}
                          disabled={pending}
                        />
                      );
                    })}
                  </div>
                  <div className={styles.hexApplyRow}>
                    <label className={styles.hexField}>
                      <span>Custom hex</span>
                      <input
                        type="text"
                        value={hexValue}
                        onChange={(event) => setHexValue(normalizeHex(event.target.value))}
                        onBlur={() => setHexValue((current) => normalizeHex(current))}
                        placeholder="#1b77be"
                        spellCheck={false}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => applySmartCover()}
                      disabled={pending}
                    >
                      Apply hex
                    </button>
                  </div>
                </div>

                <div className={styles.smartOptionGrid}>
                  <button
                    type="button"
                    className={`${styles.optionButton} ${showIcon ? styles.optionButtonActive : ""}`}
                    onClick={() => applySmartCover({ showIcon: !showIcon })}
                    disabled={pending}
                    aria-pressed={showIcon}
                  >
                    <span className={styles.optionGlyph} style={{ background: appearance.bg, color: appearance.fg }}>
                      <FormGlyph appearance={appearance} size={16} />
                    </span>
                    {showIcon ? "Symbol on" : "Symbol off"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.optionButton} ${blurCover ? styles.optionButtonActive : ""}`}
                    onClick={() => applySmartCover({ blur: !blurCover })}
                    disabled={pending}
                    aria-pressed={blurCover}
                  >
                    Blur {blurCover ? "on" : "off"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "stock" && (
              <div className={styles.stockPanel}>
                {suggestedStockCovers.length > 0 && (
                  <div className={styles.suggestionStrip}>
                    <span className={styles.panelKicker}>Suggested</span>
                    <div className={styles.stockThumbRow}>
                      {suggestedStockCovers.map((stockCover) => (
                        <button
                          key={stockCover.id}
                          type="button"
                          className={`${styles.stockThumb} ${
                            cover.stockId === stockCover.id ? styles.stockThumbActive : ""
                          }`}
                          onClick={() =>
                            persistCover({
                              mode: "stock",
                              stockId: stockCover.id,
                              imageUrl: stockCover.src,
                              alt: stockCover.alt,
                            })
                          }
                          aria-label={`Use ${stockCover.label} cover`}
                          title={stockCover.label}
                          disabled={pending}
                        >
                          <img src={stockCover.src} alt="" />
                          <span>{stockCover.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.stockLibrary}>
                  <span className={styles.panelKicker}>Stock</span>
                  <div className={styles.stockGrid}>
                    {orderedStockCovers.map((stockCover) => (
                      <button
                        key={stockCover.id}
                        type="button"
                        className={`${styles.stockTile} ${
                          cover.stockId === stockCover.id ? styles.stockTileActive : ""
                        }`}
                        onClick={() =>
                          persistCover({
                            mode: "stock",
                            stockId: stockCover.id,
                            imageUrl: stockCover.src,
                            alt: stockCover.alt,
                          })
                        }
                        aria-label={`Use ${stockCover.label} cover`}
                        title={stockCover.label}
                        disabled={pending}
                      >
                        <img src={stockCover.src} alt="" />
                        <span>{stockCover.label}</span>
                        {suggestedIds.has(stockCover.id) && <em>Suggested</em>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "upload" && (
              <div className={styles.uploadPanel}>
                <button
                  type="button"
                  className={styles.uploadDropzone}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pending}
                >
                  <span className={styles.uploadGlyph}>
                    <UploadSimple size={18} weight="bold" />
                  </span>
                  <span className={styles.panelCopy}>
                    <strong>{cover.mode === "upload" ? "Replace photo" : "Upload photo"}</strong>
                    <span>Crop, pan, and zoom before saving.</span>
                  </span>
                </button>
                {cover.mode === "upload" && cover.imageUrl && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={handleRemove}
                    disabled={pending}
                  >
                    <Trash size={13} weight="bold" />
                    Remove photo
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={styles.fileInput}
        onChange={handleFileChange}
      />

      {error && <p className={styles.error}>{error}</p>}

      {draft && (
        <div className={styles.editorBackdrop} role="presentation">
          <div className={styles.editorDialog} role="dialog" aria-modal="true" aria-label="Crop cover image">
            <div className={styles.editorHead}>
              <div>
                <span className={styles.editorKicker}>Cover editor</span>
                <h3>Crop and resize</h3>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={clearDraft}
                aria-label="Close cover editor"
                disabled={pending}
              >
                <X size={15} weight="bold" />
              </button>
            </div>

            <div className={styles.cropFrame}>
              <img
                src={draft.url}
                alt=""
                className={styles.cropImage}
                style={{
                  objectPosition: `${draft.x}% ${draft.y}%`,
                  transform: `scale(${draft.zoom})`,
                  transformOrigin: `${draft.x}% ${draft.y}%`,
                }}
              />
              <span className={styles.cropShade} />
              <span className={styles.cropBadge}>
                <Crop size={14} weight="bold" />
                Card cover crop
              </span>
            </div>

            <div className={styles.cropControls}>
              <label>
                <span>Zoom</span>
                <input
                  type="range"
                  min="1"
                  max="2.4"
                  step="0.05"
                  value={draft.zoom}
                  onChange={(event) => updateDraft({ zoom: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Horizontal</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={draft.x}
                  onChange={(event) => updateDraft({ x: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Vertical</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={draft.y}
                  onChange={(event) => updateDraft({ y: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className={styles.editorActions}>
              <button type="button" className={styles.secondaryButton} onClick={clearDraft} disabled={pending}>
                Cancel
              </button>
              <button type="button" className={styles.saveButton} onClick={handleSaveUpload} disabled={pending}>
                {pending ? (
                  <SpinnerGap size={14} weight="bold" className={styles.spinner} />
                ) : (
                  <Check size={14} weight="bold" />
                )}
                Save cover
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
