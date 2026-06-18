// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentTimeline } from "../DocumentTimeline";

describe("DocumentTimeline", () => {
  it("renders events in chronological order", () => {
    render(
      <DocumentTimeline
        events={[
          { event: "sent", timestamp: "2026-06-01T10:00:00Z" },
          { event: "viewed", timestamp: "2026-06-02T14:00:00Z" },
          { event: "signed", timestamp: "2026-06-02T14:03:00Z" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Sent");
    expect(items[2]).toHaveTextContent("Signed");
  });

  it("sorts out-of-order events by timestamp", () => {
    render(
      <DocumentTimeline
        events={[
          { event: "signed", timestamp: "2026-06-02T14:03:00Z" },
          { event: "sent", timestamp: "2026-06-01T10:00:00Z" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Sent");
    expect(items[1]).toHaveTextContent("Signed");
  });

  it("includes the actor in the event label", () => {
    render(
      <DocumentTimeline
        events={[{ event: "countersigned", timestamp: "2026-06-03T09:00:00Z", actor: "Proxy" }]}
      />,
    );
    expect(screen.getByText("Countersigned by Proxy")).toBeInTheDocument();
  });

  it("hides the list when collapsed", () => {
    render(
      <DocumentTimeline
        collapsed
        events={[{ event: "sent", timestamp: "2026-06-01T10:00:00Z" }]}
      />,
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Activity/i })).toBeInTheDocument();
  });
});
