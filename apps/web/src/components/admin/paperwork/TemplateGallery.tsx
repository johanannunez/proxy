"use client";

/**
 * TemplateGallery — the Apple-Pages-style create modal (validated in the Round 2
 * preview). Type switch (Signature | Form), category sidebar, search, a
 * "Start fresh" row (Blank + Generate with AI), and the org's own + Proxy
 * library templates as selectable cards. Presentational + callback-driven: it
 * lazy-loads lean DTOs and reports the chosen create action to the host, which
 * owns routing and the create server actions (see PaperworkShell).
 *
 * When the user clicks "Generate with AI", the modal morphs in-place (light →
 * dark) and renders the matching AI creation flow (AICreationFlow for
 * signatures, FormAIFlow for forms). Back returns to the browse view; the modal
 * stays open and owns the single portal/backdrop throughout.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Plus,
  Sparkle,
  MagnifyingGlass,
  X,
  Signature,
  FileText,
  SquaresFour,
  Folder,
  Buildings,
  ArrowLeft,
} from "@phosphor-icons/react";
import {
  TemplatePickCard,
  accentForSeed,
  type TemplatePreviewSpec,
} from "./TemplateCard";
import {
  loadGalleryData,
  type GalleryData,
  type GallerySignature,
  type GalleryForm,
} from "./gallery-actions";
import { resolveFormAppearance } from "@/app/(admin)/admin/paperwork/forms/form-icon";
import { AICreationFlow } from "@/components/admin/documents/ai-creation";
import type { AIGeneratedIntelligence } from "@/components/admin/documents/ai-creation/types";
import { FormAIFlow } from "./FormAIFlow";
import type { FormField } from "@/lib/admin/forms-types";
import styles from "./TemplateGallery.module.css";

export type GalleryKind = "signature" | "form";

export type CreateChoice =
  | { kind: GalleryKind; selection: "blank" }
  | { kind: GalleryKind; selection: "template"; templateId: string };

function signatureSpec(s: GallerySignature): TemplatePreviewSpec {
  return { kind: "signature", accent: accentForSeed(s.seed) };
}

function formSpec(f: GalleryForm): TemplatePreviewSpec {
  const a = resolveFormAppearance({ id: f.id, icon: f.icon, icon_color: f.iconColor });
  return {
    kind: "form",
    Icon: a.emoji ? undefined : a.Icon,
    emoji: a.emoji ?? undefined,
    bg: a.bg,
    fg: a.fg,
  };
}

function titleize(value: string): string {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TemplateGallery({
  open,
  initialKind,
  onClose,
  onCreate,
  onAiSignatureCreated,
  onAiFormCreated,
  initialData,
}: {
  open: boolean;
  initialKind?: GalleryKind | null;
  onClose: () => void;
  onCreate: (choice: CreateChoice) => void | Promise<void>;
  onAiSignatureCreated: (intelligence: AIGeneratedIntelligence) => void;
  onAiFormCreated: (input: {
    name: string;
    fields: FormField[];
    icon: string | null;
    iconColor: string | null;
  }) => Promise<void>;
  /** Pre-supplied data; when present the modal skips the lazy fetch. */
  initialData?: GalleryData;
}) {
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [kind, setKind] = useState<GalleryKind>(initialKind ?? "signature");
  const [selected, setSelected] = useState<string>("blank"); // "blank" | <templateId>
  const [cat, setCat] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<GalleryData | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "browse" = light template chooser; "ai" = dark in-modal AI flow
  const [view, setView] = useState<"browse" | "ai">("browse");
  // Tracks which step the active AI flow is on (forwarded via onStepChange).
  const [aiStep, setAiStep] = useState<string>("prompt");

  const isGenerating = view === "ai" && aiStep === "generating";

  useEffect(() => setMounted(true), []);

  // Reset state each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setKind(initialKind ?? "signature");
    setSelected("blank");
    setCat("all");
    setQuery("");
    setError(null);
    setView("browse");
    setAiStep("prompt");
  }, [open, initialKind]);

  // Lazy-load templates + forms on open (unless data was supplied). The action
  // resolves the org from the trusted server header, so no orgId is passed.
  useEffect(() => {
    if (!open || initialData) return;
    let alive = true;
    setLoading(true);
    loadGalleryData()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError("Could not load your templates. Try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, initialData]);

  // Escape closes (unless creating is in flight or AI is mid-generation).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !creating && !isGenerating) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, creating, isGenerating]);

  const q = query.trim().toLowerCase();

  const categories = useMemo(() => {
    if (!data) return [] as string[];
    const src = kind === "signature" ? data.signatures : data.forms;
    return Array.from(
      new Set(src.map((t) => t.category).filter((c): c is string => Boolean(c))),
    ).sort();
  }, [data, kind]);

  const matchesCat = (group: "yours" | "proxy", category: string | null) => {
    if (cat === "all") return true;
    if (cat === "yours") return group === "yours";
    if (cat === "proxy") return group === "proxy";
    return category === cat;
  };

  const { yours, proxy } = useMemo(() => {
    if (!data) return { yours: [], proxy: [] } as { yours: GallerySignature[] | GalleryForm[]; proxy: GallerySignature[] };
    if (kind === "signature") {
      const sigs = data.signatures.filter(
        (s) => (!q || s.name.toLowerCase().includes(q)) && matchesCat(s.group, s.category),
      );
      return {
        yours: sigs.filter((s) => s.group === "yours"),
        proxy: sigs.filter((s) => s.group === "proxy"),
      };
    }
    const forms = data.forms.filter(
      (f) => (!q || f.name.toLowerCase().includes(q)) && matchesCat("yours", f.category),
    );
    return { yours: forms, proxy: [] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, kind, q, cat]);

  function switchKind(next: GalleryKind) {
    setKind(next);
    setSelected("blank");
    setCat("all");
  }

  async function handleCreate() {
    if (creating) return;
    setError(null);
    let choice: CreateChoice;
    if (selected === "blank") choice = { kind, selection: "blank" };
    else choice = { kind, selection: "template", templateId: selected };
    setCreating(true);
    try {
      await onCreate(choice);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setCreating(false);
    }
  }

  const createLabel = selected === "blank" ? "Create" : "Use template";

  const showAi = true;
  const hasResults = yours.length > 0 || proxy.length > 0;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={styles.stage}>
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => !creating && !isGenerating && onClose()}
          />
          <motion.div
            className={`${styles.modal} ${view === "ai" ? styles.modalDark : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Create new paperwork"
            initial={{ opacity: 0, scale: prefersReduced ? 1 : 0.97, y: prefersReduced ? 0 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: prefersReduced ? 1 : 0.97, y: prefersReduced ? 0 : 8 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
          >
            {view === "ai" ? (
              /* ── AI view header: back arrow + close ── */
              <div className={`${styles.modalHead} ${styles.modalHeadDark}`}>
                <button
                  type="button"
                  className={styles.backBtn}
                  onClick={() => { setView("browse"); setSelected("blank"); }}
                  disabled={isGenerating}
                  aria-label="Back to templates"
                >
                  <ArrowLeft size={14} weight="bold" aria-hidden />
                  Templates
                </button>
                <button
                  type="button"
                  className={`${styles.modalClose} ${styles.modalCloseDark}`}
                  onClick={() => !isGenerating && onClose()}
                  disabled={isGenerating}
                  aria-label="Close"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
            ) : (
              /* ── Browse view header: type switch + close ── */
              <div className={styles.modalHead}>
                <div className={styles.typeSwitch} role="tablist" aria-label="Paperwork type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={kind === "signature"}
                    className={`${styles.typeBtn} ${kind === "signature" ? styles.typeBtnActive : ""}`}
                    onClick={() => switchKind("signature")}
                  >
                    <Signature size={15} weight="duotone" /> Signature
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={kind === "form"}
                    className={`${styles.typeBtn} ${kind === "form" ? styles.typeBtnActive : ""}`}
                    onClick={() => switchKind("form")}
                  >
                    <FileText size={15} weight="duotone" /> Form
                  </button>
                </div>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => !creating && onClose()}
                  aria-label="Close"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
            )}

            {view === "ai" ? (
              /* ── AI view body: full-width flow, no sidebar/footer ── */
              <AnimatePresence mode="wait">
                <motion.div
                  key={`ai-flow-${kind}`}
                  className={styles.aiBody}
                  initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {kind === "signature" ? (
                    <AICreationFlow
                      /* onExit fires on confirm — keep the modal dark while it
                         closes (view resets on next open). The back button has
                         its own handler that returns to the light chooser. */
                      onExit={() => setSelected("blank")}
                      onCreated={(intel) => onAiSignatureCreated(intel)}
                      onStepChange={(s) => setAiStep(s)}
                    />
                  ) : (
                    <FormAIFlow
                      onExit={() => setSelected("blank")}
                      onCreated={(payload) => onAiFormCreated(payload)}
                      onStepChange={(s) => setAiStep(s)}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            ) : (
              /* ── Browse view body: sidebar + main + footer ── */
              <>
                <div className={styles.modalBody}>
                  {/* Sidebar */}
                  <nav className={styles.sidebar} aria-label="Filter templates">
                    <button
                      type="button"
                      className={`${styles.catBtn} ${cat === "all" ? styles.catBtnActive : ""}`}
                      onClick={() => setCat("all")}
                    >
                      <SquaresFour size={15} weight="duotone" /> All templates
                    </button>
                    <button
                      type="button"
                      className={`${styles.catBtn} ${cat === "yours" ? styles.catBtnActive : ""}`}
                      onClick={() => setCat("yours")}
                    >
                      <Folder size={15} weight="duotone" /> Your {kind === "signature" ? "signatures" : "forms"}
                    </button>
                    {kind === "signature" && (
                      <button
                        type="button"
                        className={`${styles.catBtn} ${cat === "proxy" ? styles.catBtnActive : ""}`}
                        onClick={() => setCat("proxy")}
                      >
                        <Sparkle size={15} weight="duotone" /> Proxy library
                      </button>
                    )}
                    {categories.length > 0 && (
                      <>
                        <div className={styles.catDivider} />
                        <p className={styles.catGroupLabel}>By category</p>
                        {categories.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`${styles.catBtn} ${cat === c ? styles.catBtnActive : ""}`}
                            onClick={() => setCat(c)}
                          >
                            <Buildings size={15} weight="duotone" /> {titleize(c)}
                          </button>
                        ))}
                      </>
                    )}
                  </nav>

                  {/* Main */}
                  <div className={styles.main}>
                    <div className={styles.mainHead}>
                      <h2 className={styles.mainTitle}>Choose a template</h2>
                      <div className={styles.search}>
                        <MagnifyingGlass size={13} weight="bold" aria-hidden />
                        <input
                          placeholder="Search templates"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          aria-label="Search templates"
                        />
                      </div>
                    </div>

                    {/* Start fresh — always available so a hidden Blank/AI selection
                        can never get stranded behind a category filter. */}
                    <p className={styles.groupLabel}>Start fresh</p>
                    <div className={styles.grid}>
                      <button
                        type="button"
                        className={`${styles.startCard} ${selected === "blank" ? styles.cardSelected : ""}`}
                        onClick={() => setSelected("blank")}
                        aria-pressed={selected === "blank"}
                      >
                        <span className={styles.startPreview}>
                          <Plus size={22} weight="bold" />
                        </span>
                        <span className={styles.startName}>Blank</span>
                      </button>
                      {showAi && (
                        <button
                          type="button"
                          className={styles.startCard}
                          onClick={() => { setSelected("blank"); setView("ai"); }}
                          aria-label="Generate with AI"
                        >
                          <span className={`${styles.startPreview} ${styles.aiPreview}`}>
                            <Sparkle size={22} weight="fill" />
                          </span>
                          <span className={styles.startName}>Generate with AI</span>
                        </button>
                      )}
                    </div>

                    {/* Body states */}
                    {loading ? (
                      <div className={styles.statusBlock}>Loading your templates…</div>
                    ) : error ? (
                      <div className={styles.statusBlock}>{error}</div>
                    ) : (
                      <>
                        {yours.length > 0 && (
                          <>
                            <p className={styles.groupLabel}>
                              Your {kind === "signature" ? "signatures" : "forms"}
                            </p>
                            <div className={styles.grid}>
                              {(yours as Array<GallerySignature | GalleryForm>).map((t) => (
                                <TemplatePickCard
                                  key={t.id}
                                  spec={
                                    kind === "signature"
                                      ? signatureSpec(t as GallerySignature)
                                      : formSpec(t as GalleryForm)
                                  }
                                  name={t.name}
                                  selected={selected === t.id}
                                  onSelect={() => setSelected(t.id)}
                                />
                              ))}
                            </div>
                          </>
                        )}

                        {proxy.length > 0 && (
                          <>
                            <p className={styles.groupLabel}>
                              Proxy library <span className={styles.groupHint}>pre-made, ready to send</span>
                            </p>
                            <div className={styles.grid}>
                              {(proxy as GallerySignature[]).map((t) => (
                                <TemplatePickCard
                                  key={t.id}
                                  spec={signatureSpec(t)}
                                  name={t.name}
                                  selected={selected === t.id}
                                  onSelect={() => setSelected(t.id)}
                                />
                              ))}
                            </div>
                          </>
                        )}

                        {!hasResults && (
                          <div className={styles.statusBlock}>
                            No {kind === "signature" ? "signatures" : "forms"} match. Start from blank
                            {showAi ? " or generate one with AI" : ""}.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className={styles.modalFoot}>
                  {error && !loading && <span className={styles.footError}>{error}</span>}
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => !creating && onClose()}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.createBtn}
                    onClick={handleCreate}
                    disabled={creating || loading}
                  >
                    {creating ? "Working…" : createLabel}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
