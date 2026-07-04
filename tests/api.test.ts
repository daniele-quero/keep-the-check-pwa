import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as api from "../src/api";
import { sendImageToAI } from "../src/api";
import { AiExtractionError } from "../src/aiPrompt";
import type { ProviderConfig } from "../src/config";
import { PROXY_ENDPOINT } from "../src/config";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.removeItem("aiProviderFallback.nextStartIndex");
});

describe("api module surface", () => {
  it("does not export legacy text-pipeline functions", () => {
    expect(api).not.toHaveProperty("recognizeOcr");
    expect(api).not.toHaveProperty("parseWithGemini");
    expect(api).not.toHaveProperty("parseWithGroq");
  });
});

describe("sendImageToAI", () => {
  const multiFixture = readFileSync(
    join(__dirname, "fixtures", "ai", "multi-price.json"),
    "utf8"
  );

  afterEach(() => {
    vi.useRealTimers();
  });

  function okText(text: string): Response {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => text,
    } as unknown as Response;
  }

  function provider(
    id: string,
    endpointTemplate: string,
    overrides: Partial<ProviderConfig> = {}
  ): ProviderConfig {
    return {
      id,
      name: id,
      endpointTemplate,
      model: "vision-model",
      apiKey: "provider-key",
      useProxy: true,
      enabled: true,
      priority: 1,
      timeoutMs: 30000,
      supportsImages: true,
      failureThreshold: 3,
      cooldownMs: 120000,
      ...overrides,
    };
  }

  it("uses fallback only for providers with API key present", async () => {
    const missingKey = provider("missing-key", "https://missing-key.test/v1", {
      apiKey: "",
      priority: 1,
    });
    const withKey = provider("with-key", "https://with-key.test/v1", {
      apiKey: "k-live",
      priority: 2,
    });

    mockFetch.mockResolvedValueOnce(okText(multiFixture));

    const result = await sendImageToAI("AAAA", "PROMPT", {
      endpoint: "",
      aiProviders: [missingKey, withKey],
    });

    expect(result.version).toBe("1.0");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe("https://with-key.test/v1");
  });

  it("POSTs to endpoint with Authorization Bearer header when apiKey set and useProxy false", async () => {
    mockFetch.mockResolvedValueOnce(okText(multiFixture));

    await sendImageToAI("AAAA", "PROMPT-X", {
      endpoint: "https://example.test/v1/chat",
      apiKey: "KEY",
      model: "gpt-test",
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://example.test/v1/chat");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["Authorization"]).toBe("Bearer KEY");
    const body = JSON.parse(options.body);
    expect(body.model).toBe("gpt-test");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("omits Authorization header when useProxy is true", async () => {
    mockFetch.mockResolvedValueOnce(okText(multiFixture));

    await sendImageToAI("AAAA", "P", {
      endpoint: "/ai-proxy",
      apiKey: "SHOULD-NOT-LEAK",
      useProxy: true,
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/ai-proxy");
    expect(options.headers["Authorization"]).toBeUndefined();
  });

  it("strips data:image/png;base64, prefix before embedding", async () => {
    mockFetch.mockResolvedValueOnce(okText(multiFixture));

    await sendImageToAI("data:image/png;base64,ABCDEF", "P", {
      endpoint: "https://e.test",
      apiKey: "k",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const imagePart = body.messages[0].content.find(
      (c: { type: string }) => c.type === "image_url"
    );
    expect(imagePart.image_url.url).toBe("data:image/jpeg;base64,ABCDEF");
  });

  it("includes the verbatim prompt in the text content part", async () => {
    mockFetch.mockResolvedValueOnce(okText(multiFixture));
    const prompt = "verbatim-prompt-\u00a0-with-special-€-chars";

    await sendImageToAI("RAWB64", prompt, {
      endpoint: "https://e.test",
      apiKey: "k",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const textPart = body.messages[0].content.find(
      (c: { type: string }) => c.type === "text"
    );
    expect(textPart.text).toBe(prompt);
  });

  it("parses an OpenAI-style choices response into AiExtractionResult", async () => {
    const envelope = JSON.stringify({
      choices: [{ message: { content: multiFixture } }],
    });
    mockFetch.mockResolvedValueOnce(okText(envelope));

    const result = await sendImageToAI("b64", "p", {
      endpoint: "https://e.test",
      apiKey: "k",
    });

    expect(result.version).toBe("1.0");
    expect(result.products).toHaveLength(1);
    expect(result.products[0].prices).toHaveLength(3);
  });

  it("parses a raw JSON response body", async () => {
    mockFetch.mockResolvedValueOnce(okText(multiFixture));

    const result = await sendImageToAI("b64", "p", {
      endpoint: "https://e.test",
      apiKey: "k",
    });

    expect(result.products[0].name).toBe("Pasta Barilla 500g");
  });

  it("throws AiExtractionError code 'http_error' on 500", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "boom",
    } as unknown as Response);

    await expect(
      sendImageToAI("b64", "p", { endpoint: "https://e.test", apiKey: "k" })
    ).rejects.toMatchObject({
      name: "AiExtractionError",
      code: "http_error",
    });
  });

  it("throws code 'timeout' when fetch never resolves within timeoutMs", async () => {
    vi.useFakeTimers();

    mockFetch.mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            (err as Error & { name: string }).name = "AbortError";
            reject(err);
          });
        })
    );

    const promise = sendImageToAI("b64", "p", {
      endpoint: "https://e.test",
      apiKey: "k",
      timeoutMs: 1000,
    });

    const assertion = expect(promise).rejects.toMatchObject({
      name: "AiExtractionError",
      code: "timeout",
    });

    await vi.advanceTimersByTimeAsync(1500);
    await assertion;
  });

  it("throws code 'network' when fetch rejects with a generic Error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("DNS failure"));

    await expect(
      sendImageToAI("b64", "p", { endpoint: "https://e.test", apiKey: "k" })
    ).rejects.toMatchObject({
      name: "AiExtractionError",
      code: "network",
    });
  });

  it("external AbortSignal from caller triggers abort path", async () => {
    mockFetch.mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            (err as Error & { name: string }).name = "AbortError";
            reject(err);
          });
        })
    );

    const external = new AbortController();
    const promise = sendImageToAI("b64", "p", {
      endpoint: "https://e.test",
      apiKey: "k",
      timeoutMs: 60000,
      signal: external.signal,
    });

    const assertion = expect(promise).rejects.toBeInstanceOf(AiExtractionError);
    external.abort();
    await assertion;
  });

  it("uses round-robin fallback across enabled providers when the first provider fails", async () => {
    const p1 = provider("hf-test", "https://provider-a.test/v1", { priority: 1 });
    const p2 = provider("mistral-test", "https://provider-b.test/v1", { priority: 2 });

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "boom",
      } as unknown as Response)
      .mockResolvedValueOnce(okText(multiFixture));

    const result = await sendImageToAI("AAAA", "PROMPT", {
      endpoint: "",
      aiProviders: [p1, p2],
    });

    expect(result.version).toBe("1.0");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe("https://provider-a.test/v1");
    expect(mockFetch.mock.calls[1][0]).toBe("https://provider-b.test/v1");
  });

  it("rotates start provider between consecutive calls", async () => {
    const p1 = provider("hf-rotate", "https://rotate-a.test/v1", { priority: 1 });
    const p2 = provider("cf-rotate", "https://rotate-b.test/v1", { priority: 2 });

    mockFetch.mockResolvedValueOnce(okText(multiFixture));
    await sendImageToAI("AAAA", "PROMPT-1", {
      endpoint: "",
      aiProviders: [p1, p2],
    });

    mockFetch.mockResolvedValueOnce(okText(multiFixture));
    await sendImageToAI("BBBB", "PROMPT-2", {
      endpoint: "",
      aiProviders: [p1, p2],
    });

    expect(mockFetch.mock.calls[0][0]).toBe("https://rotate-a.test/v1");
    expect(mockFetch.mock.calls[1][0]).toBe("https://rotate-b.test/v1");
  });

  it("omits Authorization header for provider when useProxy is true", async () => {
    const p1 = provider("proxy-provider", "https://proxy.test/v1", {
      useProxy: true,
      apiKey: "secret-should-not-leak",
    });

    mockFetch.mockResolvedValueOnce(okText(multiFixture));
    await sendImageToAI("AAAA", "PROMPT", {
      endpoint: "",
      aiProviders: [p1],
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Authorization"]).toBeUndefined();
  });

  it("uses Replicate adapter payload and Token authorization in direct mode", async () => {
    const p1 = provider("replicate", "https://api.replicate.com/v1/predictions", {
      useProxy: false,
      apiKey: "r8_xxx",
      model: "meta/meta-llama-3.2-11b-vision-instruct",
    });

    mockFetch.mockResolvedValueOnce(okText(multiFixture));
    await sendImageToAI("ABC123", "PROMPT", {
      endpoint: "",
      aiProviders: [p1],
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.replicate.com/v1/predictions");
    expect(options.headers["Authorization"]).toBe("Token r8_xxx");

    const body = JSON.parse(options.body);
    expect(body.model).toBe("meta/meta-llama-3.2-11b-vision-instruct");
    expect(body.input.prompt).toBe("PROMPT");
    expect(body.input.image).toBe("data:image/jpeg;base64,ABC123");
  });
});

describe("sendImageToAI – proxy transport", () => {
  const multiFixture = readFileSync(
    join(__dirname, "fixtures", "ai", "multi-price.json"),
    "utf8"
  );

  // Use a fresh module instance so provider cooldown state from earlier tests
  // (fake timers) does not leak into these single-provider proxy calls.
  let sendImageToAIFresh: typeof sendImageToAI;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../src/api");
    sendImageToAIFresh = mod.sendImageToAI;
  });

  function okText(text: string): Response {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => text,
    } as unknown as Response;
  }

  it("posts to the proxy endpoint forwarding X-Provider-Id and no Authorization header", async () => {
    mockFetch.mockResolvedValueOnce(okText(multiFixture));

    await sendImageToAIFresh("AAAA", "PROMPT", {
      endpoint: PROXY_ENDPOINT,
      apiKey: "SHOULD-NOT-LEAK",
      useProxy: true,
      extraHeaders: { "X-Provider-Id": "groq" },
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(PROXY_ENDPOINT);
    expect(options.headers["X-Provider-Id"]).toBe("groq");
    expect(options.headers["Authorization"]).toBeUndefined();
  });

  it("surfaces a proxy 502 as an http_error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      text: async () => JSON.stringify({ error: "all_providers_failed" }),
    } as unknown as Response);

    await expect(
      sendImageToAIFresh("AAAA", "PROMPT", {
        endpoint: PROXY_ENDPOINT,
        useProxy: true,
        extraHeaders: { "X-Provider-Id": "groq" },
      })
    ).rejects.toMatchObject({
      name: "AiExtractionError",
      code: "http_error",
    });
  });
});
