import { describe, expect, it } from "vitest";
import {
  buildResponsesCSV,
  filterResponses,
  type UnifiedFormResponse,
} from "./responses-csv";

function row(overrides: Partial<UnifiedFormResponse> = {}): UnifiedFormResponse {
  return {
    id: "r1",
    form_id: "f1",
    form_name: "Guest Intake",
    respondent_name: "Ada Lovelace",
    respondent_email: "ada@example.com",
    property_id: "p1",
    property_name: "Jadwin Ave",
    workspace_id: "w1",
    workspace_name: "Jadwin Portfolio",
    submitted_at: "2026-06-01T12:00:00Z",
    completed_at: "2026-06-01T12:05:00Z",
    data: { favorite_color: "blue" },
    ...overrides,
  };
}

describe("buildResponsesCSV", () => {
  it("includes the fixed columns and dynamic field columns from response data", () => {
    const csv = buildResponsesCSV([
      row({ data: { favorite_color: "blue", guests: 4 } }),
      row({ id: "r2", data: { guests: 2, arrival: "late" } }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "respondent_name,respondent_email,form_name,property,submitted_at,status,favorite_color,guests,arrival",
    );
    expect(lines[1]).toBe(
      "Ada Lovelace,ada@example.com,Guest Intake,Jadwin Ave,2026-06-01T12:00:00Z,Complete,blue,4,",
    );
    expect(lines[2]).toContain(",2,late");
    expect(lines).toHaveLength(3);
  });

  it("escapes commas, quotes, and newlines per RFC 4180", () => {
    const csv = buildResponsesCSV([
      row({
        respondent_name: 'Grace "Amazing" Hopper, PhD',
        data: { note: "line one\nline two" },
      }),
    ]);
    expect(csv).toContain('"Grace ""Amazing"" Hopper, PhD"');
    expect(csv).toContain('"line one\nline two"');
  });

  it("marks unfinished responses as Partial and serializes object values", () => {
    const csv = buildResponsesCSV([
      row({ completed_at: null, data: { platforms: ["airbnb", "vrbo"] } }),
    ]);
    expect(csv).toContain("Partial");
    expect(csv).toContain('"[""airbnb"",""vrbo""]"');
  });

  it("returns just the fixed header when there are no rows", () => {
    expect(buildResponsesCSV([])).toBe(
      "respondent_name,respondent_email,form_name,property,submitted_at,status",
    );
  });
});

describe("filterResponses", () => {
  const rows = [
    row({ id: "a", form_id: "f1", property_id: "p1", submitted_at: "2026-06-01T12:00:00Z" }),
    row({ id: "b", form_id: "f2", property_id: "p2", submitted_at: "2026-06-05T12:00:00Z" }),
    row({ id: "c", form_id: "f1", property_id: null, submitted_at: "2026-06-10T12:00:00Z" }),
  ];

  it("filters by form", () => {
    expect(filterResponses(rows, { formId: "f1" }).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("filters by property", () => {
    expect(filterResponses(rows, { propertyId: "p2" }).map((r) => r.id)).toEqual(["b"]);
  });

  it("filters by inclusive date range", () => {
    expect(
      filterResponses(rows, { dateFrom: "2026-06-05", dateTo: "2026-06-10" }).map((r) => r.id),
    ).toEqual(["b", "c"]);
  });

  it("returns everything when no filters set", () => {
    expect(filterResponses(rows, {})).toHaveLength(3);
  });
});
