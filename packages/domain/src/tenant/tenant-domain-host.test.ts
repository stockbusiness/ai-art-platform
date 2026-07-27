import { describe, expect, it } from "vitest";

import { InvalidTenantDomainHostError, TenantDomainHost } from "./tenant-domain-host.js";

describe("TenantDomainHost", () => {
  it("accepts a valid hostname", () => {
    const result = TenantDomainHost.create("example.com");
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.toString()).toBe("example.com");
  });

  it("accepts a multi-label subdomain", () => {
    const result = TenantDomainHost.create("shop.acme.example.com");
    expect(result.ok).toBe(true);
  });

  it("normalizes to lowercase", () => {
    const result = TenantDomainHost.create("Example.COM");
    expect(result.ok && result.value.toString()).toBe("example.com");
  });

  it("treats hosts differing only by case as equal", () => {
    const a = TenantDomainHost.create("Example.com");
    const b = TenantDomainHost.create("EXAMPLE.COM");
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
  });

  it("rejects an empty string", () => {
    const result = TenantDomainHost.create("");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(InvalidTenantDomainHostError);
  });

  it("rejects a whitespace-only string", () => {
    expect(TenantDomainHost.create("   ").ok).toBe(false);
  });

  it("rejects a scheme", () => {
    expect(TenantDomainHost.create("https://example.com").ok).toBe(false);
  });

  it("rejects a path", () => {
    expect(TenantDomainHost.create("example.com/path").ok).toBe(false);
  });

  it("rejects a port", () => {
    expect(TenantDomainHost.create("example.com:8080").ok).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(TenantDomainHost.create("exa mple.com").ok).toBe(false);
    expect(TenantDomainHost.create("exa_mple.com").ok).toBe(false);
  });

  it("rejects a leading hyphen in a label", () => {
    expect(TenantDomainHost.create("-example.com").ok).toBe(false);
  });

  it("rejects a trailing hyphen in a label", () => {
    expect(TenantDomainHost.create("example-.com").ok).toBe(false);
  });
});
