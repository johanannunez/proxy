// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentPacket } from "../DocumentPacket";

describe("DocumentPacket", () => {
  it("shows completion count", () => {
    render(
      <DocumentPacket
        title="Owner Package"
        description="Your core agreements"
        items={[
          { status: "on_file", document_key: "host_rental_agreement", title: "Agreement" },
          { status: "needed", document_key: "w9", title: "W-9" },
        ]}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("1 of 2 complete")).toBeInTheDocument();
  });

  it("shows all-complete state when every item is on_file", () => {
    render(
      <DocumentPacket
        title="Owner Package"
        description="Your core agreements"
        items={[{ status: "on_file", document_key: "host_rental_agreement", title: "Agreement" }]}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("surfaces attention copy when items need the owner", () => {
    render(
      <DocumentPacket
        title="Payment Setup"
        description="Fees and authorizations"
        items={[
          { status: "needed", document_key: "ach_authorization", title: "ACH" },
          { status: "sent", document_key: "card_authorization", title: "Card" },
          { status: "on_file", document_key: "paid_onboarding_fee", title: "Fee" },
        ]}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("2 items need your attention")).toBeInTheDocument();
  });
});
