import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getSelectedProvider,
  setSelectedProvider,
  clearSelection,
  SELECTION_TTL_MS,
} from "../src/providerSelection";

const STORAGE_KEY = "aiProviderSelection";

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("providerSelection", () => {
  it("returns null when nothing is stored", () => {
    expect(getSelectedProvider()).toBeNull();
  });

  it("set then get returns the provider id", () => {
    setSelectedProvider("groq");
    expect(getSelectedProvider()).toBe("groq");
  });

  it("ignores unknown provider ids on set", () => {
    setSelectedProvider("not-a-real-provider");
    expect(getSelectedProvider()).toBeNull();
  });

  it("overwrite replaces the previous selection", () => {
    setSelectedProvider("groq");
    setSelectedProvider("mistral");
    expect(getSelectedProvider()).toBe("mistral");
  });

  it("returns null and clears storage after the TTL expires", () => {
    const now = 1_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);
    setSelectedProvider("groq");

    vi.setSystemTime(now + SELECTION_TTL_MS + 1);
    expect(getSelectedProvider()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("still valid just before the TTL boundary", () => {
    const now = 5_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);
    setSelectedProvider("groq");

    vi.setSystemTime(now + SELECTION_TTL_MS - 1);
    expect(getSelectedProvider()).toBe("groq");
  });

  it("clearSelection removes the stored value", () => {
    setSelectedProvider("groq");
    clearSelection();
    expect(getSelectedProvider()).toBeNull();
  });

  it("tolerates malformed JSON in storage", () => {
    sessionStorage.setItem(STORAGE_KEY, "{not json");
    expect(getSelectedProvider()).toBeNull();
  });

  it("ignores a stored entry whose provider id is no longer in the catalog", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ providerId: "ghost", expiresAt: Date.now() + 10000 })
    );
    expect(getSelectedProvider()).toBeNull();
  });

  it("never stores a key value, only the provider id", () => {
    setSelectedProvider("groq");
    const raw = sessionStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw).toContain("groq");
    expect(raw).not.toMatch(/AI_KEY_/);
    expect(raw).not.toMatch(/Bearer/);
  });
});
