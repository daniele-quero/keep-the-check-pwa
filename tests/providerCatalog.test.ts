import { describe, it, expect } from "vitest";
import {
  PROVIDER_CATALOG,
  getCatalogEntry,
  getVisionProviders,
} from "../src/providerCatalog";

describe("providerCatalog", () => {
  it("has unique provider ids", () => {
    const ids = PROVIDER_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only https hardcoded endpoints", () => {
    for (const entry of PROVIDER_CATALOG) {
      expect(entry.endpoint.startsWith("https://")).toBe(true);
    }
  });

  it("names every env key using the AI_KEY_ convention (names only, no values)", () => {
    for (const entry of PROVIDER_CATALOG) {
      expect(entry.envKey).toMatch(/^AI_KEY_[A-Z0-9_]+$/);
    }
  });

  it("hardcodes deterministic tuning params", () => {
    for (const entry of PROVIDER_CATALOG) {
      expect(entry.temperature).toBe(0);
      expect(typeof entry.maxTokens).toBe("number");
      expect(entry.maxTokens).toBeGreaterThan(0);
    }
  });

  it("includes the curated free-tier vision providers", () => {
    const ids = PROVIDER_CATALOG.map((e) => e.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "google-gemini",
        "groq",
        "mistral",
        "openrouter",
        "huggingface",
        "xai-grok",
      ])
    );
  });

  it("getVisionProviders returns only vision-capable providers", () => {
    const visionIds = getVisionProviders().map((e) => e.id);
    expect(visionIds).toContain("google-gemini");
    expect(visionIds).toContain("groq");
    expect(visionIds).toContain("xai-grok");
  });

  it("openrouter carries attribution extra headers", () => {
    const or = getCatalogEntry("openrouter");
    expect(or?.extraHeaders).toMatchObject({
      "HTTP-Referer": expect.any(String),
      "X-Title": expect.any(String),
    });
  });

  it("getCatalogEntry returns undefined for unknown ids", () => {
    expect(getCatalogEntry("does-not-exist")).toBeUndefined();
  });

  it("contains no literal api key values", () => {
    const serialized = JSON.stringify(PROVIDER_CATALOG);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(serialized).not.toMatch(/Bearer /);
  });
});
