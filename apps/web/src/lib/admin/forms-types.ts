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
  | "divider";

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  validation?: Record<string, unknown>;
  ratingMax?: number;
};

export type FormSchema = {
  version: 1;
  fields: FormField[];
  settings: {
    submitButtonText?: string;
    successMessage?: string;
    notifyEmail?: string | null;
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
};

export type UpdateFormInput = {
  name?: string;
  description?: string;
  schema?: FormSchema;
  is_public?: boolean;
  slug?: string | null;
  is_active?: boolean;
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
