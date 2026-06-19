import { describe, it, expect, vi, beforeEach } from "vitest";

// resolveOrgForRequestHost builds a supabase-js service client lazily; give
// the tests a controllable fake before importing the module under test.
type QueryResult = { data: unknown; error: { message: string } | null };

const maybeSingleMock = vi.fn<() => Promise<QueryResult>>();
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));
const createClientMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...(args as [])),
}));

import {
  TtlCache,
  resolveOrgForRequestHost,
  PROXY_DEFAULT_ORG,
  ORG_CACHE_TTL_MS,
} from "../cache";
import { DEFAULT_AGENCY_ID } from "@/types/agencies";

beforeEach(() => {
  maybeSingleMock.mockReset();
  eqMock.mockClear();
  selectMock.mockClear();
  fromMock.mockClear();
  createClientMock.mockClear();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-secret";
});

describe("TtlCache", () => {
  it("returns cached values inside the TTL and expires them after", () => {
    let clock = 1_000;
    const cache = new TtlCache<string | null>(60_000, () => clock);

    cache.set("slug:acme", "cached");
    expect(cache.get("slug:acme")).toBe("cached");

    clock += 59_999;
    expect(cache.get("slug:acme")).toBe("cached");

    clock += 1;
    expect(cache.get("slug:acme")).toBeUndefined();
  });

  it("caches null (negative) results distinctly from misses", () => {
    const cache = new TtlCache<string | null>(60_000, () => 0);
    expect(cache.get("slug:nope")).toBeUndefined();
    cache.set("slug:nope", null);
    expect(cache.get("slug:nope")).toBeNull();
  });
});

describe("resolveOrgForRequestHost", () => {
  it("returns the Proxy agency for first-party hosts without any lookup", async () => {
    const org = await resolveOrgForRequestHost("www.myproxyhost.com");
    expect(org).toEqual(PROXY_DEFAULT_ORG);
    expect(org?.id).toBe(DEFAULT_AGENCY_ID);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("resolves a known tenant subdomain and caches the result", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "org-2", slug: "acme", plan_tier: "pro" },
      error: null,
    });

    const first = await resolveOrgForRequestHost("acme.myproxyhost.com");
    expect(first).toEqual({ id: "org-2", slug: "acme", planTier: "pro" });
    expect(fromMock).toHaveBeenCalledWith("agencies");
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);

    // Second request within the TTL: served from cache, no second lookup.
    const second = await resolveOrgForRequestHost("acme.myproxyhost.com");
    expect(second).toEqual(first);
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it("returns null for an unknown myproxyhost subdomain (proxy redirects)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const org = await resolveOrgForRequestHost("ghost-tenant.myproxyhost.com");
    expect(org).toBeNull();
  });

  it("falls back to the Proxy agency for an unknown custom domain", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const org = await resolveOrgForRequestHost("portal.unknown-company.com");
    expect(org).toEqual(PROXY_DEFAULT_ORG);
  });

  it("resolves a known white-label custom domain", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "org-3", slug: "globex", plan_tier: "white_label" },
      error: null,
    });
    const org = await resolveOrgForRequestHost("portal.globex.com");
    expect(org).toEqual({ id: "org-3", slug: "globex", planTier: "white_label" });
  });

  it("exposes the 60 second TTL the design specifies", () => {
    expect(ORG_CACHE_TTL_MS).toBe(60_000);
  });
});
