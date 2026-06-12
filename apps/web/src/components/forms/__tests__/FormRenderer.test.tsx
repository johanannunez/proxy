// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Workstream A5: conditional visibility in the form renderer.
 *
 * Covers: hidden fields stay mounted with display none, visibility reacts to
 * live values, hidden required fields never block submission, and hidden
 * values are excluded from the submission payload.
 */

import { FormRenderer } from "../FormRenderer";
import type { Form, FormField } from "@/lib/admin/forms-types";

function buildForm(fields: FormField[]): Form {
  return {
    id: "form-1",
    org_id: "org-1",
    name: "Test form",
    description: null,
    schema: {
      version: 1,
      fields,
      settings: { submitButtonText: "Send" },
    },
    is_public: true,
    slug: "test",
    is_active: true,
    created_by: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

const conditionalFields: FormField[] = [
  {
    id: "has_pets",
    type: "single_choice",
    label: "Do you have pets?",
    required: true,
    options: ["Yes", "No"],
  },
  {
    id: "pet_details",
    type: "short_text",
    label: "Tell us about your pets",
    required: true,
    conditions: {
      combinator: "and",
      conditions: [{ field: "has_pets", operator: "equals", value: "Yes" }],
    },
  },
];

function fieldWrap(fieldId: string): HTMLElement {
  const el = document.querySelector(`[data-field-id="${fieldId}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`missing wrap ${fieldId}`);
  return el;
}

describe("FormRenderer conditional visibility", () => {
  it("hides a conditional field until its condition passes, without unmounting it", () => {
    render(<FormRenderer form={buildForm(conditionalFields)} onSubmit={vi.fn()} />);

    // Mounted but hidden.
    expect(fieldWrap("pet_details").style.display).toBe("none");
    expect(screen.getByLabelText("Tell us about your pets")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    expect(fieldWrap("pet_details").style.display).not.toBe("none");

    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    expect(fieldWrap("pet_details").style.display).toBe("none");
  });

  it("does not let a hidden required field block submission", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<FormRenderer form={buildForm(conditionalFields)} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ has_pets: "No" });
  });

  it("still enforces required validation on visible conditional fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<FormRenderer form={buildForm(conditionalFields)} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("This field is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("excludes values of fields hidden at submit time from the payload", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<FormRenderer form={buildForm(conditionalFields)} onSubmit={onSubmit} />);

    // Fill the conditional field while visible, then hide it again.
    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    fireEvent.change(screen.getByLabelText("Tell us about your pets"), {
      target: { value: "Two cats" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({ has_pets: "No" });
    expect("pet_details" in payload).toBe(false);
  });

  it("preserves an entered value across a hide/show round trip", () => {
    render(<FormRenderer form={buildForm(conditionalFields)} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    fireEvent.change(screen.getByLabelText("Tell us about your pets"), {
      target: { value: "Two cats" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));

    expect(screen.getByLabelText("Tell us about your pets")).toHaveValue("Two cats");
  });

  it("renders interactive fields without a submit button in preview mode", () => {
    render(<FormRenderer form={buildForm(conditionalFields)} preview />);

    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    const radio = screen.getByRole("radio", { name: "Yes" });
    expect(radio).toBeEnabled();
    fireEvent.click(radio);
    expect(fieldWrap("pet_details").style.display).not.toBe("none");
  });
});
