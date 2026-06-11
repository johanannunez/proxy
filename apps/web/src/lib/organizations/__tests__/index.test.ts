import { describe, it, expect, vi, beforeEach } from "vitest";

// The module under test imports "server-only", which throws outside a React
// Server Components environment. Stub it for the node test runtime.
vi.mock("server-only", () => ({}));

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

const singleMock = vi.fn<() => Promise<QueryResult>>();

function chainableBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: singleMock,
  };
  return builder;
}

const fromMock = vi.fn(() => chainableBuilder());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

import { getOrgBySlug, getOrgByCustomDomain, getOrgBranding } from "../index";
import { PROXY_ORG_ID } from "@/types/organizations";

beforeEach(() => {
  fromMock.mockClear();
  singleMock.mockReset();
});

describe("getOrgBySlug", () => {
  it("returns null for unknown slug", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" },
    });
    const result = await getOrgBySlug("unknown-slug-xyz");
    expect(result).toBeNull();
    expect(fromMock).toHaveBeenCalledWith("organizations");
  });

  it("returns the organization row for a known slug", async () => {
    const proxyOrg = {
      id: PROXY_ORG_ID,
      name: "Proxy",
      slug: "proxy",
      plan_tier: "white_label",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      created_at: "2026-06-10T00:00:00Z",
      updated_at: "2026-06-10T00:00:00Z",
    };
    singleMock.mockResolvedValue({ data: proxyOrg, error: null });
    const result = await getOrgBySlug("proxy");
    expect(result).toEqual(proxyOrg);
  });
});

describe("getOrgByCustomDomain", () => {
  it("returns null when no org owns the domain", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { message: "no rows", code: "PGRST116" },
    });
    const result = await getOrgByCustomDomain("portal.unknown.com");
    expect(result).toBeNull();
    expect(fromMock).toHaveBeenCalledWith("organizations");
  });
});

describe("getOrgBranding", () => {
  it("returns null when branding row is missing", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { message: "no rows", code: "PGRST116" },
    });
    const result = await getOrgBranding("11111111-1111-1111-1111-111111111111");
    expect(result).toBeNull();
    expect(fromMock).toHaveBeenCalledWith("organization_branding");
  });

  it("returns the branding row for an org", async () => {
    const branding = {
      org_id: PROXY_ORG_ID,
      logo_url: null,
      favicon_url: null,
      primary_color: "#0F172A",
      accent_color: "#6366F1",
      font_heading: "Inter",
      font_body: "Inter",
      custom_domain: null,
      email_sender_name: null,
      email_sender_domain: null,
      powered_by_proxy: false,
      updated_at: "2026-06-10T00:00:00Z",
    };
    singleMock.mockResolvedValue({ data: branding, error: null });
    const result = await getOrgBranding(PROXY_ORG_ID);
    expect(result).toEqual(branding);
  });
});
