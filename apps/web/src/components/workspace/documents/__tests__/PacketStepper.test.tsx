// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PacketStepper } from "../PacketStepper";
import type { PacketItem } from "../packet-types";

const items: PacketItem[] = [
  {
    status: "on_file",
    document_key: "host_rental_agreement",
    title: "Host Rental Agreement",
    description: "Management agreement and fee structure.",
    action: "sign",
  },
  {
    status: "needed",
    document_key: "w9",
    title: "W-9",
    description: "Taxpayer identification for 1099 reporting.",
    action: "upload",
  },
];

describe("PacketStepper", () => {
  it("shows the current step and position", () => {
    render(
      <PacketStepper
        packetTitle="Owner Package"
        items={items}
        currentIndex={1}
        onNext={() => {}}
        onBack={() => {}}
        onClose={() => {}}
        onAction={() => {}}
      />,
    );
    expect(screen.getByText("W-9")).toBeInTheDocument();
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
  });

  it("calls onNext when next is clicked", () => {
    const onNext = vi.fn();
    render(
      <PacketStepper
        packetTitle="Owner Package"
        items={items}
        currentIndex={0}
        onNext={onNext}
        onBack={() => {}}
        onClose={() => {}}
        onAction={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onClose from Done on the last step", () => {
    const onClose = vi.fn();
    render(
      <PacketStepper
        packetTitle="Owner Package"
        items={items}
        currentIndex={1}
        onNext={() => {}}
        onBack={() => {}}
        onClose={onClose}
        onAction={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fires the step action with the current item", () => {
    const onAction = vi.fn();
    render(
      <PacketStepper
        packetTitle="Owner Package"
        items={items}
        currentIndex={1}
        onNext={() => {}}
        onBack={() => {}}
        onClose={() => {}}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Upload/ }));
    expect(onAction).toHaveBeenCalledWith(items[1]);
  });
});
