import type {
  Form,
  FormCoverBackground,
  FormCoverMode,
  FormCoverSettings,
  FormSchema,
} from "./forms-types";

export type FormStockCover = {
  id: string;
  label: string;
  src: string;
  alt: string;
  keywords: readonly string[];
};

export type FormCoverColor = {
  id: string;
  label: string;
  value: string;
};

export type ResolvedFormCover = {
  mode: FormCoverMode;
  imageUrl: string | null;
  imagePath: string | null;
  stockId: string | null;
  color: string | null;
  blur: boolean;
  showIcon: boolean;
  background: FormCoverBackground;
  alt: string;
  isHeaderImage: boolean;
};

export type FormCoverMockup = {
  title: string;
  fields: string[];
  buttonText: string;
};

type CoverForm = Pick<Form, "name" | "description" | "schema">;

const SUMMARY_SKIP_FIELD_TYPES = new Set<string>([
  "section_header",
  "description",
  "divider",
  "page_break",
]);

export const FORM_CARD_TITLE_MAX = 46;
export const FORM_CARD_SUMMARY_MAX = 76;

export const FORM_STOCK_COVERS: readonly FormStockCover[] = [
  {
    id: "property",
    label: "Property",
    src: "/paperwork/form-covers/property.png",
    alt: "Modern property exterior with clean architectural lines",
    keywords: [
      "property",
      "home",
      "house",
      "listing",
      "rental",
      "address",
      "unit",
      "building",
      "inspection",
    ],
  },
  {
    id: "bedroom",
    label: "Stay",
    src: "/paperwork/form-covers/bedroom.png",
    alt: "Calm guest room with fresh bedding and warm daylight",
    keywords: [
      "guest",
      "stay",
      "booking",
      "reservation",
      "airbnb",
      "arrival",
      "checkout",
      "bedroom",
      "cleanliness",
      "survey",
    ],
  },
  {
    id: "wifi",
    label: "Wi-Fi",
    src: "/paperwork/form-covers/wifi.png",
    alt: "Premium workspace with a router and soft blue light",
    keywords: [
      "wifi",
      "wi-fi",
      "network",
      "ssid",
      "router",
      "internet",
      "password",
      "signal",
      "access",
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    src: "/paperwork/form-covers/maintenance.png",
    alt: "Organized maintenance tools on a refined work surface",
    keywords: [
      "maintenance",
      "repair",
      "issue",
      "damage",
      "work",
      "service",
      "request",
      "fix",
      "cleaning",
      "inspection",
    ],
  },
  {
    id: "documents",
    label: "Documents",
    src: "/paperwork/form-covers/documents.png",
    alt: "Neatly arranged documents and a pen on a desk",
    keywords: [
      "document",
      "documents",
      "paperwork",
      "signature",
      "agreement",
      "contract",
      "policy",
      "receipt",
      "invoice",
    ],
  },
  {
    id: "welcome",
    label: "Welcome",
    src: "/paperwork/form-covers/welcome.png",
    alt: "Welcoming entry table with keys and a soft lamp",
    keywords: [
      "welcome",
      "onboarding",
      "intake",
      "tenant",
      "resident",
      "key",
      "keys",
      "entry",
      "move",
      "arrival",
    ],
  },
] as const;

export const FORM_COVER_COLORS: readonly FormCoverColor[] = [
  { id: "blue", label: "Blue", value: "#1b77be" },
  { id: "teal", label: "Teal", value: "#0f8c7f" },
  { id: "amber", label: "Amber", value: "#b27908" },
  { id: "rose", label: "Rose", value: "#c94867" },
  { id: "indigo", label: "Indigo", value: "#4c63d2" },
  { id: "slate", label: "Slate", value: "#475569" },
] as const;

const DEFAULT_FORM_COVER_COLOR = "#1b77be";
const DEFAULT_FORM_COVER_BACKGROUND: FormCoverBackground = "minimal";

function cleanString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildFormCoverMockup(form: CoverForm): FormCoverMockup {
  const fields = form.schema.fields
    .filter((field) => !["section_header", "description", "divider", "page_break"].includes(field.type))
    .map((field) => cleanString(field.label))
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);

  return {
    title: cleanString(form.name) ?? "Untitled form",
    fields: fields.length > 0 ? fields : ["Response detail", "Contact information"],
    buttonText: cleanString(form.schema.settings.submitButtonText) ?? "Submit",
  };
}

export function formCardResponseLabel(count: number): string {
  if (count === 0) return "No responses";
  return `${count} ${count === 1 ? "response" : "responses"}`;
}

export function formCardQuestionLabel(count: number): string {
  return `${count} ${count === 1 ? "question" : "questions"}`;
}

export function limitFormCardText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength + 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const safeClip =
    lastSpace > maxLength * 0.65 ? clipped.slice(0, lastSpace) : clipped.slice(0, maxLength);
  return `${safeClip.trim()}...`;
}

function sentenceList(labels: string[]): string {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function formCardSummary(form: CoverForm): string {
  const manual = form.description?.trim();
  if (manual) return limitFormCardText(manual, FORM_CARD_SUMMARY_MAX);

  const fields = (form.schema?.fields ?? []).filter(
    (field) => field.label.trim() && !SUMMARY_SKIP_FIELD_TYPES.has(field.type),
  );
  if (fields.length === 0) {
    return "Add questions before sharing this form.";
  }

  const labels = fields.slice(0, 2).map((field) => field.label.trim());
  const extraCount = fields.length - labels.length;
  const extraText =
    extraCount > 0
      ? `, plus ${extraCount} more ${extraCount === 1 ? "question" : "questions"}`
      : "";
  return limitFormCardText(`Collects ${sentenceList(labels)}${extraText}.`, FORM_CARD_SUMMARY_MAX);
}

function findStockCover(id: string | null | undefined): FormStockCover | null {
  if (!id) return null;
  return FORM_STOCK_COVERS.find((cover) => cover.id === id) ?? null;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formSearchSegments(form: CoverForm): { primary: string; fields: string } {
  return {
    primary: normalizeSearchText([form.name, form.description ?? ""].join(" ")),
    fields: normalizeSearchText(
      form.schema.fields
        .flatMap((field) => [
          field.label,
          field.placeholder ?? "",
          ...(field.options ?? []),
        ])
        .join(" "),
    ),
  };
}

function scoreStockCover(
  segments: { primary: string; fields: string },
  cover: FormStockCover,
): number {
  const primaryWords = new Set(segments.primary.split(/\s+/).filter(Boolean));
  const fieldWords = new Set(segments.fields.split(/\s+/).filter(Boolean));
  return cover.keywords.reduce((score, keyword) => {
    const normalized = normalizeSearchText(keyword);
    if (!normalized) return score;
    let nextScore = score;
    if (primaryWords.has(normalized)) nextScore += 14;
    else if (segments.primary.includes(normalized)) nextScore += 9;
    if (fieldWords.has(normalized)) nextScore += 3;
    else if (segments.fields.includes(normalized)) nextScore += 1;
    return nextScore;
  }, 0);
}

export function suggestStockCovers(form: CoverForm, limit = 4): FormStockCover[] {
  const segments = formSearchSegments(form);
  if (!segments.primary && !segments.fields) return [];

  return FORM_STOCK_COVERS.map((cover) => ({
    cover,
    score: scoreStockCover(segments, cover),
  }))
    .filter((item) => item.score >= 9)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.cover);
}

export function resolveFormCover(form: CoverForm): ResolvedFormCover {
  const settings = form.schema.settings.cover;
  const legacyImageUrl = cleanString(form.schema.settings.coverImageUrl);
  const legacyImagePath = cleanString(form.schema.settings.coverImagePath);
  const legacyAlt = cleanString(form.schema.settings.coverImageAlt);
  const showIcon = settings?.showIcon ?? true;
  const background = settings?.background ?? DEFAULT_FORM_COVER_BACKGROUND;

  if (settings?.mode === "stock") {
    const stock = findStockCover(settings.stockId);
    if (stock) {
      return {
        mode: "stock",
        imageUrl: stock.src,
        imagePath: null,
        stockId: stock.id,
        color: null,
        blur: false,
        showIcon,
        background,
        alt: cleanString(settings.alt) ?? stock.alt,
        isHeaderImage: true,
      };
    }
  }

  if (settings?.mode === "upload") {
    const imageUrl = cleanString(settings.imageUrl) ?? legacyImageUrl;
    return {
      mode: "upload",
      imageUrl,
      imagePath: cleanString(settings.imagePath) ?? legacyImagePath,
      stockId: null,
      color: null,
      blur: false,
      showIcon,
      background,
      alt: cleanString(settings.alt) ?? legacyAlt ?? `${form.name} cover image`,
      isHeaderImage: Boolean(imageUrl),
    };
  }

  if (settings?.mode === "color") {
    return {
      mode: "color",
      imageUrl: null,
      imagePath: null,
      stockId: null,
      color: cleanString(settings.color) ?? DEFAULT_FORM_COVER_COLOR,
      blur: settings.blur ?? true,
      showIcon,
      background,
      alt: `${form.name} color cover`,
      isHeaderImage: false,
    };
  }

  if (legacyImageUrl) {
    return {
      mode: "upload",
      imageUrl: legacyImageUrl,
      imagePath: legacyImagePath,
      stockId: null,
      color: null,
      blur: false,
      showIcon,
      background,
      alt: legacyAlt ?? `${form.name} cover image`,
      isHeaderImage: true,
    };
  }

  return {
    mode: "smart",
    imageUrl: null,
    imagePath: null,
    stockId: null,
    color: null,
    blur: true,
    showIcon: true,
    background: DEFAULT_FORM_COVER_BACKGROUND,
    alt: `${form.name} smart cover`,
    isHeaderImage: false,
  };
}

export function withFormCover(
  schema: FormSchema,
  patch: FormCoverSettings & { mode: FormCoverMode },
): FormSchema {
  const stock = patch.mode === "stock" ? findStockCover(patch.stockId) : null;
  const nextCover: FormCoverSettings =
    patch.mode === "stock" && stock
      ? {
          mode: "stock",
          stockId: stock.id,
          imageUrl: stock.src,
          imagePath: null,
          alt: patch.alt ?? stock.alt,
          color: null,
          blur: false,
          showIcon: patch.showIcon ?? true,
          background: patch.background ?? DEFAULT_FORM_COVER_BACKGROUND,
        }
      : patch.mode === "upload"
        ? {
            mode: "upload",
            stockId: null,
            imageUrl: patch.imageUrl ?? null,
            imagePath: patch.imagePath ?? null,
            alt: patch.alt ?? null,
            color: null,
            blur: false,
            showIcon: patch.showIcon ?? true,
            background: patch.background ?? DEFAULT_FORM_COVER_BACKGROUND,
          }
        : patch.mode === "color"
          ? {
              mode: "color",
              stockId: null,
              imageUrl: null,
              imagePath: null,
              alt: null,
              color: patch.color ?? DEFAULT_FORM_COVER_COLOR,
              blur: patch.blur ?? true,
              showIcon: patch.showIcon ?? true,
              background: patch.background ?? DEFAULT_FORM_COVER_BACKGROUND,
            }
          : {
              mode: "smart",
              stockId: null,
              imageUrl: null,
              imagePath: null,
              alt: null,
              color: null,
              blur: true,
              showIcon: patch.showIcon ?? true,
              background: patch.background ?? DEFAULT_FORM_COVER_BACKGROUND,
            };

  const legacyImageUrl =
    nextCover.mode === "upload" || nextCover.mode === "stock"
      ? nextCover.imageUrl ?? null
      : null;
  const legacyImagePath = nextCover.mode === "upload" ? nextCover.imagePath ?? null : null;
  const legacyImageAlt =
    nextCover.mode === "upload" || nextCover.mode === "stock"
      ? nextCover.alt ?? null
      : null;

  return {
    ...schema,
    settings: {
      ...schema.settings,
      cover: nextCover,
      coverImageUrl: legacyImageUrl,
      coverImagePath: legacyImagePath,
      coverImageAlt: legacyImageAlt,
    },
  };
}
