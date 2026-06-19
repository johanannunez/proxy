import { describe, it, expect } from "vitest";
import { classifyHost } from "../host";

describe("classifyHost", () => {
  it("treats all first-party production hosts as default", () => {
    expect(classifyHost("www.myproxyhost.com")).toEqual({ kind: "default" });
    expect(classifyHost("app.myproxyhost.com")).toEqual({ kind: "default" });
    expect(classifyHost("myproxyhost.com")).toEqual({ kind: "default" });
  });

  it("treats local development hosts as default, with or without port", () => {
    expect(classifyHost("localhost")).toEqual({ kind: "default" });
    expect(classifyHost("localhost:4000")).toEqual({ kind: "default" });
    expect(classifyHost("127.0.0.1:4000")).toEqual({ kind: "default" });
    expect(classifyHost("[::1]:4000")).toEqual({ kind: "default" });
  });

  it("treats Vercel preview deployments as default", () => {
    expect(classifyHost("proxy-git-feature-johanannunez.vercel.app")).toEqual({
      kind: "default",
    });
  });

  it("treats empty or missing hosts as default", () => {
    expect(classifyHost(null)).toEqual({ kind: "default" });
    expect(classifyHost(undefined)).toEqual({ kind: "default" });
    expect(classifyHost("")).toEqual({ kind: "default" });
  });

  it("extracts the tenant slug from a myproxyhost subdomain", () => {
    expect(classifyHost("acme.myproxyhost.com")).toEqual({
      kind: "subdomain",
      slug: "acme",
    });
    expect(classifyHost("ACME.myproxyhost.com")).toEqual({
      kind: "subdomain",
      slug: "acme",
    });
    expect(classifyHost("acme.myproxyhost.com:443")).toEqual({
      kind: "subdomain",
      slug: "acme",
    });
  });

  it("passes nested labels through as a (never-matching) subdomain", () => {
    expect(classifyHost("a.b.myproxyhost.com")).toEqual({
      kind: "subdomain",
      slug: "a.b",
    });
  });

  it("classifies everything else as a custom domain", () => {
    expect(classifyHost("portal.acme.com")).toEqual({
      kind: "custom-domain",
      domain: "portal.acme.com",
    });
    expect(classifyHost("Portal.Acme.com:8443")).toEqual({
      kind: "custom-domain",
      domain: "portal.acme.com",
    });
  });
});
