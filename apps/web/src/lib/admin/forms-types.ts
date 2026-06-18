export type FormFieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "single_choice"
  | "multiple_choice"
  | "dropdown"
  | "file_upload"
  | "rating"
  | "signature"
  | "section_header"
  | "description"
  | "divider"
  | "page_break";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty";

export type FieldCondition = {
  /** fieldId of the field whose value is checked. */
  field: string;
  operator: ConditionOperator;
  /** Not needed for is_empty / is_not_empty. */
  value?: string;
};

export type FieldConditionGroup = {
  combinator: "and" | "or";
  conditions: FieldCondition[];
};

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  not_contains: "does not contain",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

/** Operators that compare against a typed value. */
export const VALUE_OPERATORS: ConditionOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
];

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  validation?: Record<string, unknown>;
  ratingMax?: number;
  /** If set, the field is hidden unless the conditions pass. */
  conditions?: FieldConditionGroup;
};

export type FormCompletion = {
  type: "message" | "portal_home" | "custom";
  customUrl?: string;
};

export type FormCoverMode = "smart" | "stock" | "upload" | "color";
export type FormCoverBackground = "wash" | "mesh" | "paper" | "minimal";

export type FormCoverSettings = {
  mode: FormCoverMode;
  stockId?: string | null;
  imageUrl?: string | null;
  imagePath?: string | null;
  alt?: string | null;
  color?: string | null;
  blur?: boolean;
  showIcon?: boolean;
  background?: FormCoverBackground | null;
};

export type FormSchema = {
  version: 1;
  fields: FormField[];
  settings: {
    submitButtonText?: string;
    successMessage?: string;
    notifyEmail?: string | null;
    /** @deprecated Use completion instead. Kept for back-compat reads. */
    redirectUrl?: string;
    completion?: FormCompletion;
    cover?: FormCoverSettings;
    /** @deprecated Use cover instead. Kept for back-compat reads. */
    coverImageUrl?: string | null;
    /** @deprecated Use cover instead. Kept for back-compat reads. */
    coverImagePath?: string | null;
    /** @deprecated Use cover instead. Kept for back-compat reads. */
    coverImageAlt?: string | null;
  };
};

export type Form = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  schema: FormSchema;
  is_public: boolean;
  slug: string | null;
  is_active: boolean;
  created_by: string | null;
  /** Status board tracking + archive (migration 20260612090000_template_tracking).
      Rows read before the migration runs lack these columns; the forms helpers
      normalize to product defaults. */
  tracked: boolean;
  category: string | null;
  archived_at: string | null;
  /** Custom appearance. icon is a symbol key. icon_color is a preset key or
      hex color. Null falls back to a deterministic tint and default glyph. */
  icon: string | null;
  icon_color: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateFormInput = {
  org_id: string;
  name: string;
  description?: string;
  schema?: FormSchema;
  is_public?: boolean;
  created_by?: string;
  icon?: string | null;
  icon_color?: string | null;
};

export type UpdateFormInput = {
  name?: string;
  description?: string;
  schema?: FormSchema;
  is_public?: boolean;
  slug?: string | null;
  is_active?: boolean;
  tracked?: boolean;
  category?: string | null;
  archived_at?: string | null;
  icon?: string | null;
  icon_color?: string | null;
};

export type FormResponse = {
  id: string;
  form_id: string;
  respondent_profile_id: string | null;
  property_id: string | null;
  data: Record<string, unknown>;
  submitted_at: string;
  metadata: Record<string, unknown>;
};

export type CreateFormResponseInput = Omit<FormResponse, "id" | "submitted_at">;

export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  number: "Number",
  email: "Email",
  phone: "Phone",
  date: "Date",
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  dropdown: "Dropdown",
  file_upload: "File Upload",
  rating: "Rating",
  signature: "Signature",
  section_header: "Section Header",
  description: "Description",
  divider: "Divider",
  page_break: "Page Break",
};

export const INPUT_FIELD_TYPES: FormFieldType[] = [
  "short_text",
  "long_text",
  "number",
  "email",
  "phone",
  "date",
  "single_choice",
  "multiple_choice",
  "dropdown",
  "file_upload",
  "rating",
  "signature",
];

export const LAYOUT_FIELD_TYPES: FormFieldType[] = [
  "section_header",
  "description",
  "divider",
  "page_break",
];

export const DEFAULT_FORM_SCHEMA: FormSchema = {
  version: 1,
  fields: [],
  settings: {
    submitButtonText: "Submit",
    successMessage: "Thank you. Your response has been recorded.",
    notifyEmail: null,
  },
};
