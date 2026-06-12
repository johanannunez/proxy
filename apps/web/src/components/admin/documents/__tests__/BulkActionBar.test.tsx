// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BulkActionBar } from "../BulkActionBar";

function renderBar(overrides: Partial<Parameters<typeof BulkActionBar>[0]> = {}) {
  const handlers = {
    onRemind: vi.fn(),
    onRequest: vi.fn(),
    onWaive: vi.fn(),
    onSend: vi.fn(),
    onClear: vi.fn(),
  };
  render(
    <BulkActionBar
      selectedCount={3}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe("BulkActionBar", () => {
  it("shows the selection count with pluralized label", () => {
    renderBar();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("owners selected")).toBeInTheDocument();
  });

  it("uses singular label for one owner", () => {
    renderBar({ selectedCount: 1 });
    expect(screen.getByText("owner selected")).toBeInTheDocument();
  });

  it("fires each action callback", () => {
    const handlers = renderBar();
    fireEvent.click(screen.getByRole("button", { name: /remind/i }));
    fireEvent.click(screen.getByRole("button", { name: /request/i }));
    fireEvent.click(screen.getByRole("button", { name: /waive/i }));
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(handlers.onRemind).toHaveBeenCalledOnce();
    expect(handlers.onRequest).toHaveBeenCalledOnce();
    expect(handlers.onWaive).toHaveBeenCalledOnce();
    expect(handlers.onSend).toHaveBeenCalledOnce();
    expect(handlers.onClear).toHaveBeenCalledOnce();
  });

  it("disables Request and Send when no document type is active", () => {
    renderBar({ docTypeHint: "Select a SecureDoc card first" });
    expect(screen.getByRole("button", { name: /request/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /remind/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /waive/i })).toBeEnabled();
  });

  it("disables everything while busy", () => {
    renderBar({ busy: true });
    expect(screen.getByRole("button", { name: /remind/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /waive/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /clear/i })).toBeDisabled();
  });
});
