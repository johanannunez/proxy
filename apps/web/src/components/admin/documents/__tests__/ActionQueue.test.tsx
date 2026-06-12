// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionQueue } from "@/app/(admin)/admin/paperwork/ActionQueue";
import type { ActionQueueItem } from "@/lib/admin/action-queue-types";

function item(overrides: Partial<ActionQueueItem> = {}): ActionQueueItem {
  return {
    id: "overdue-1",
    kind: "overdue_unsigned",
    owner_id: "owner-1",
    owner_name: "Ada Lovelace",
    owner_avatar_url: null,
    document_id: "doc-1",
    document_title: "Host Rental Agreement",
    document_key: "host_rental_agreement",
    days_waiting: 9,
    expires_at: null,
    primary_action: "remind",
    urgency: "medium",
    ...overrides,
  };
}

describe("ActionQueue", () => {
  it("renders the all-caught-up empty state", () => {
    render(<ActionQueue items={[]} onAction={vi.fn()} onView={vi.fn()} />);
    expect(screen.getByText("No actions needed")).toBeInTheDocument();
    expect(screen.getByText(/You're all caught up\./)).toBeInTheDocument();
  });

  it("renders owner, document, kind badge, and waiting time", () => {
    render(<ActionQueue items={[item()]} onAction={vi.fn()} onView={vi.fn()} />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Host Rental Agreement")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("9 days waiting")).toBeInTheDocument();
  });

  it("fires the primary action and the view callback", () => {
    const onAction = vi.fn();
    const onView = vi.fn();
    render(<ActionQueue items={[item()]} onAction={onAction} onView={onView} />);
    fireEvent.click(screen.getByRole("button", { name: /remind/i }));
    fireEvent.click(screen.getByRole("button", { name: /view details/i }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "overdue-1" }));
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: "overdue-1" }));
  });

  it("labels each kind with the right action button", () => {
    render(
      <ActionQueue
        items={[
          item({ id: "a", kind: "declined_signature", primary_action: "resend", urgency: "high" }),
          item({ id: "b", kind: "pending_countersignature", primary_action: "countersign", urgency: "high" }),
          item({ id: "c", kind: "stuck_review", primary_action: "review" }),
        ]}
        onAction={vi.fn()}
        onView={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /resend/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /countersign/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review/i })).toBeInTheDocument();
  });

  it("disables the busy item's action button", () => {
    render(
      <ActionQueue items={[item()]} onAction={vi.fn()} onView={vi.fn()} busyId="overdue-1" />,
    );
    expect(screen.getByRole("button", { name: /working/i })).toBeDisabled();
  });
});
