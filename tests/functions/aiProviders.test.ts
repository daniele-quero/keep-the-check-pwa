import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import handler from "../../netlify/functions/ai-providers";
import { PROVIDER_CATALOG } from "../../src/providerCatalog";

function getReq(): Request {
  return new Request("https://app.test/.netlify/functions/ai-providers", {
    method: "GET",
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ai-providers function", () => {
  it("returns 405 for non-GET methods", async () => {
    const res = await handler(
      new Request("https://app.test/.netlify/functions/ai-providers", {
        method: "POST",
      })
    );
    expect(res.status).toBe(405);
  });

  it("lists exactly the catalog provider ids", async () => {
    const res = await handler(getReq());
    const body = (await res.json()) as {
      providers: Array<{ id: string }>;
    };
    const ids = body.providers.map((p) => p.id).sort();
    const catalogIds = PROVIDER_CATALOG.map((p) => p.id).sort();
    expect(ids).toEqual(catalogIds);
  });

  it("reports hasKey=true only for providers with a configured env var", async () => {
    vi.stubEnv("AI_KEY_GROQ", "server-secret");
    // Ensure another provider has no key.
    vi.stubEnv("AI_KEY_MISTRAL", "");

    const res = await handler(getReq());
    const body = (await res.json()) as {
      providers: Array<{ id: string; hasKey: boolean }>;
    };
    const byId = new Map(body.providers.map((p) => [p.id, p.hasKey]));

    expect(byId.get("groq")).toBe(true);
    expect(byId.get("mistral")).toBe(false);
    expect(byId.get("google-gemini")).toBe(false);
  });

  it("never returns any key value in the response", async () => {
    vi.stubEnv("AI_KEY_GROQ", "super-secret-key-value");
    const res = await handler(getReq());
    const text = await res.text();
    expect(text).not.toContain("super-secret-key-value");
    expect(text).not.toContain("AI_KEY_");
  });
});
