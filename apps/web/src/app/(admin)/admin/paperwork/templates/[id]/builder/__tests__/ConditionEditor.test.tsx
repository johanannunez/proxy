// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Workstream A5: "Show if" condition editor in the field property panel.
 */

import { ConditionEditor } from "../ConditionEditor";
import type {
  FieldConditionGroup,
  FormField,
} from "@/lib/admin/forms-types";

const sourceChoice: FormField = {
  id: "f1",
  type: "dropdown",
  label: "Property type",
  options: ["House", "Condo"],
};
const sourceText: FormField = { id: "f2", type: "short_text", label: "City" };
const sectionHeader: FormField = {
  id: "f3",
  type: "section_header",
  label: "Section",
};
const target: FormField = { id: "f4", type: "short_text", label: "Unit" };

const allFields = [sourceChoice, sourceText, sectionHeader, target];

function renderEditor(
  conditions: FieldConditionGroup | undefined,
  onChange = vi.fn(),
) {
  render(
    <ConditionEditor
      field={{ ...target, conditions }}
      allFields={allFields}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe("ConditionEditor", () => {
  it("defaults to Always show", () => {
    renderEditor(undefined);
    expect(screen.getByRole("button", { name: "Always show" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Show conditionally" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("creates a first condition against the first eligible field when switched to conditional", () => {
    const onChange = renderEditor(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Show conditionally" }));
    expect(onChange).toHaveBeenCalledWith({
      combinator: "and",
      conditions: [{ field: "f1", operator: "equals", value: "" }],
    });
  });

  it("disables conditional mode when there are no other input fields", () => {
    render(
      <ConditionEditor
        field={target}
        allFields={[sectionHeader, target]}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Show conditionally" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/add another input field/i),
    ).toBeInTheDocument();
  });

  it("clears conditions when switched back to Always show", () => {
    const onChange = renderEditor({
      combinator: "and",
      conditions: [{ field: "f1", operator: "equals", value: "House" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Always show" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("offers only other input fields as condition sources (no layout fields, not itself)", () => {
    renderEditor({
      combinator: "and",
      conditions: [{ field: "f1", operator: "equals", value: "" }],
    });
    // Open the field select (shows the current field's label).
    fireEvent.click(screen.getByRole("button", { name: /Property type/ }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("City");
    expect(options).not.toContain("Section");
    expect(options).not.toContain("Unit");
  });

  it("uses the source field's options as a value select for choice fields", () => {
    renderEditor({
      combinator: "and",
      conditions: [{ field: "f1", operator: "equals", value: "" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Choose a value" }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["House", "Condo"]);
  });

  it("uses a free text value input for non-choice source fields", () => {
    renderEditor({
      combinator: "and",
      conditions: [{ field: "f2", operator: "contains", value: "Rich" }],
    });
    expect(screen.getByLabelText("Condition value")).toHaveValue("Rich");
  });

  it("emits the typed value", () => {
    const onChange = renderEditor({
      combinator: "and",
      conditions: [{ field: "f2", operator: "equals", value: "" }],
    });
    fireEvent.change(screen.getByLabelText("Condition value"), {
      target: { value: "Richland" },
    });
    expect(onChange).toHaveBeenCalledWith({
      combinator: "and",
      conditions: [{ field: "f2", operator: "equals", value: "Richland" }],
    });
  });

  it("drops the value and hides the value editor for is_empty operators", () => {
    const onChange = renderEditor({
      combinator: "and",
      conditions: [{ field: "f2", operator: "equals", value: "x" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "equals" }));
    fireEvent.click(screen.getByRole("option", { name: "is empty" }));
    expect(onChange).toHaveBeenCalledWith({
      combinator: "and",
      conditions: [{ field: "f2", operator: "is_empty", value: undefined }],
    });
  });

  it("hides the value editor when the operator needs no value", () => {
    renderEditor({
      combinator: "and",
      conditions: [{ field: "f2", operator: "is_not_empty" }],
    });
    expect(screen.queryByLabelText("Condition value")).not.toBeInTheDocument();
  });

  it("resets the value when the source field changes", () => {
    const onChange = renderEditor({
      combinator: "and",
      conditions: [{ field: "f1", operator: "equals", value: "House" }],
    });
    fireEvent.click(screen.getByRole("button", { name: /Property type/ }));
    fireEvent.click(screen.getByRole("option", { name: "City" }));
    expect(onChange).toHaveBeenCalledWith({
      combinator: "and",
      conditions: [{ field: "f2", operator: "equals", value: "" }],
    });
  });

  it("adds another condition", () => {
    const onChange = renderEditor({
      combinator: "and",
      conditions: [{ field: "f1", operator: "equals", value: "House" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Add condition" }));
    expect(onChange).toHaveBeenCalledWith({
      combinator: "and",
      conditions: [
        { field: "f1", operator: "equals", value: "House" },
        { field: "f1", operator: "equals", value: "" },
      ],
    });
  });

  it("caps conditions at five", () => {
    renderEditor({
      combinator: "and",
      conditions: Array.from({ length: 5 }, () => ({
        field: "f2" as const,
        operator: "is_not_empty" as const,
      })),
    });
    expect(screen.getByRole("button", { name: "Add condition" })).toBeDisabled();
    expect(screen.getByText(/up to 5 conditions/i)).toBeInTheDocument();
  });

  it("shows the AND/OR combinator toggle only with two or more conditions", () => {
    renderEditor({
      combinator: "and",
      conditions: [{ field: "f2", operator: "is_not_empty" }],
    });
    expect(screen.queryByRole("button", { name: "AND" })).not.toBeInTheDocument();
  });

  it("switches the combinator to OR", () => {
    const conditions: FieldConditionGroup = {
      combinator: "and",
      conditions: [
        { field: "f1", operator: "equals", value: "House" },
        { field: "f2", operator: "is_not_empty" },
      ],
    };
    const onChange = renderEditor(conditions);
    expect(screen.getByRole("button", { name: "AND" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "OR" }));
    expect(onChange).toHaveBeenCalledWith({
      ...conditions,
      combinator: "or",
    });
  });

  it("removes a condition", () => {
    const onChange = renderEditor({
      combinator: "and",
      conditions: [
        { field: "f1", operator: "equals", value: "House" },
        { field: "f2", operator: "is_not_empty" },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove condition 2" }));
    expect(onChange).toHaveBeenCalledWith({
      combinator: "and",
      conditions: [{ field: "f1", operator: "equals", value: "House" }],
    });
  });

  it("reverts to Always show when the last condition is removed", () => {
    const onChange = renderEditor({
      combinator: "and",
      conditions: [{ field: "f1", operator: "equals", value: "House" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove condition 1" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
