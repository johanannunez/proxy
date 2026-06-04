"use client";

import { useEffect } from "react";

type Props = {
  formId: string;
};

export function FormViewTracker({ formId }: Props) {
  useEffect(() => {
    fetch(`/api/forms/${formId}/view`, { method: "POST" }).catch(() => {});
  }, [formId]);
  return null;
}
