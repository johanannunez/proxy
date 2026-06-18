"use client";

/**
 * Compatibility wrapper. New form settings use BrandStudio directly so the
 * picker can score suggestions from the title and fields.
 */

import type { Form } from "@/lib/admin/forms-types";
import { DEFAULT_FORM_SCHEMA } from "@/lib/admin/forms-types";
import { BrandStudio } from "./BrandStudio";

export function FormAppearancePicker({
  form,
  formId,
  icon,
  iconColor,
}: {
  form?: Form;
  formId: string;
  icon: string | null;
  iconColor: string | null;
}) {
  const fallbackForm: Form = {
    id: formId,
    org_id: "",
    name: "Form",
    description: null,
    schema: DEFAULT_FORM_SCHEMA,
    is_public: false,
    slug: null,
    is_active: false,
    created_by: null,
    tracked: true,
    category: null,
    archived_at: null,
    icon,
    icon_color: iconColor,
    created_at: "",
    updated_at: "",
  };

  return <BrandStudio form={form ?? fallbackForm} />;
}
