import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import handler from "../../netlify/functions/ai-proxy";
import { parseAiExtractionJson } from "../../src/aiPrompt";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const OPENAI_BODY = {
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "PROMPT" },
        {
          type: "image_url",
          image_url: { url: "data:image/jpeg;base64,AAAA" },
        },
      ],
    },
  ],
  response_format: { type: "json_object" },
};

const EXTRACTION_JSON = JSON.stringify({
  version: "1.0",
  products: [],
  image_text: "",
  metadata: { processing_ms: 1, model: "x" },
  warnings: [],
  uncertain: false,
});

function okResponse(text: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => text,
  } as unknown as Response;
}

function errResponse(status: number): Response {
  return {
    ok: false,
    status,
    statusText: "ERR",
    text: async () => "err",
  } as unknown as Response;
}

function proxyReq(
  body: unknown,
  headers: Record<string, string> = {}
): Request {
  return new Request("https://app.test/.netlify/functions/ai-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ai-proxy function", () => {
  it("returns 405 for non-POST methods", async () => {
    const res = await handler(
      new Request("https://app.test/.netlify/functions/ai-proxy", {
        method: "GET",
      })
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 when neither messages nor imageBase64 are present", async () => {
    vi.stubEnv("AI_KEY_GROQ", "k");
    const res = await handler(proxyReq({ providerId: "groq" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing_image");
  });

  it("returns 502 when no provider has a configured key", async () => {
    const res = await handler(proxyReq(OPENAI_BODY, { "X-Provider-Id": "groq" }));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("no_providers_with_key");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("tries the selected provider first", async () => {
    vi.stubEnv("AI_KEY_GOOGLE_GEMINI", "gem");
    vi.stubEnv("AI_KEY_GROQ", "grq");
    mockFetch.mockResolvedValueOnce(okResponse(EXTRACTION_JSON));

    const res = await handler(proxyReq(OPENAI_BODY, { "X-Provider-Id": "groq" }));
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.groq.com/openai/v1/chat/completions"
    );
  });

  it("cycles to the next keyed vision provider on a 429", async () => {
    vi.stubEnv("AI_KEY_GROQ", "grq");
    vi.stubEnv("AI_KEY_MISTRAL", "mst");
    mockFetch
      .mockResolvedValueOnce(errResponse(429))
      .mockResolvedValueOnce(okResponse(EXTRACTION_JSON));

    const res = await handler(
      proxyReq(OPENAI_BODY, { "X-Provider-Id": "groq" })
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.groq.com/openai/v1/chat/completions"
    );
    expect(mockFetch.mock.calls[1][0]).toBe(
      "https://api.mistral.ai/v1/chat/completions"
    );
  });

  it("cycles on a 5xx from the selected provider", async () => {
    vi.stubEnv("AI_KEY_GROQ", "grq");
    vi.stubEnv("AI_KEY_MISTRAL", "mst");
    mockFetch
      .mockResolvedValueOnce(errResponse(503))
      .mockResolvedValueOnce(okResponse(EXTRACTION_JSON));

    const res = await handler(
      proxyReq(OPENAI_BODY, { "X-Provider-Id": "groq" })
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("cycles on a network error", async () => {
    vi.stubEnv("AI_KEY_GROQ", "grq");
    vi.stubEnv("AI_KEY_MISTRAL", "mst");
    mockFetch
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(okResponse(EXTRACTION_JSON));

    const res = await handler(
      proxyReq(OPENAI_BODY, { "X-Provider-Id": "groq" })
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("skips providers that have no configured key", async () => {
    // Only mistral has a key; selected groq should be skipped from the order.
    vi.stubEnv("AI_KEY_MISTRAL", "mst");
    mockFetch.mockResolvedValueOnce(okResponse(EXTRACTION_JSON));

    const res = await handler(
      proxyReq(OPENAI_BODY, { "X-Provider-Id": "groq" })
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.mistral.ai/v1/chat/completions"
    );
  });

  it("injects the server-side Authorization key and never echoes it", async () => {
    vi.stubEnv("AI_KEY_GROQ", "server-only-secret");
    mockFetch.mockResolvedValueOnce(okResponse(EXTRACTION_JSON));

    const res = await handler(
      proxyReq(OPENAI_BODY, { "X-Provider-Id": "groq" })
    );

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer server-only-secret");

    const returned = await res.text();
    expect(returned).not.toContain("server-only-secret");
  });

  it("returns the upstream body verbatim and it is parseable by parseAiExtractionJson", async () => {
    vi.stubEnv("AI_KEY_GROQ", "grq");
    const envelope = JSON.stringify({
      choices: [{ message: { content: EXTRACTION_JSON } }],
    });
    mockFetch.mockResolvedValueOnce(okResponse(envelope));

    const res = await handler(
      proxyReq(OPENAI_BODY, { "X-Provider-Id": "groq" })
    );
    const text = await res.text();
    expect(text).toBe(envelope);
    const parsed = parseAiExtractionJson(text);
    expect(parsed.version).toBe("1.0");
  });

  it("returns 502 with per-provider attempts when all providers fail", async () => {
    vi.stubEnv("AI_KEY_GROQ", "grq");
    vi.stubEnv("AI_KEY_MISTRAL", "mst");
    mockFetch.mockResolvedValue(errResponse(500));

    const res = await handler(
      proxyReq(OPENAI_BODY, { "X-Provider-Id": "groq" })
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as {
      error: string;
      attempts: Array<{ providerId: string; status: number | null }>;
    };
    expect(body.error).toBe("all_providers_failed");
    expect(body.attempts.length).toBeGreaterThanOrEqual(2);
    expect(body.attempts[0]).toMatchObject({ providerId: "groq", status: 500 });
  });

  it("adds OpenRouter attribution headers on the upstream call", async () => {
    vi.stubEnv("AI_KEY_OPENROUTER", "ork");
    mockFetch.mockResolvedValueOnce(okResponse(EXTRACTION_JSON));

    await handler(proxyReq(OPENAI_BODY, { "X-Provider-Id": "openrouter" }));

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["HTTP-Referer"]).toBeTruthy();
    expect(init.headers["X-Title"]).toBeTruthy();
  });

  it("omits response_format for providers without json mode (huggingface)", async () => {
    vi.stubEnv("AI_KEY_HUGGINGFACE", "hf");
    mockFetch.mockResolvedValueOnce(okResponse(EXTRACTION_JSON));

    await handler(proxyReq(OPENAI_BODY, { "X-Provider-Id": "huggingface" }));

    const [, init] = mockFetch.mock.calls[0];
    const sentBody = JSON.parse(init.body);
    expect(sentBody.response_format).toBeUndefined();
    expect(sentBody.model).toBe("Qwen/Qwen2.5-VL-7B-Instruct");
  });

  it("overrides model and tuning per provider", async () => {
    vi.stubEnv("AI_KEY_GROQ", "grq");
    mockFetch.mockResolvedValueOnce(okResponse(EXTRACTION_JSON));

    await handler(proxyReq(OPENAI_BODY, { "X-Provider-Id": "groq" }));

    const [, init] = mockFetch.mock.calls[0];
    const sentBody = JSON.parse(init.body);
    expect(sentBody.model).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
    expect(sentBody.temperature).toBe(0);
    expect(sentBody.max_tokens).toBe(1024);
    expect(sentBody.response_format).toEqual({ type: "json_object" });
  });

  it("supports the compact { imageBase64, prompt } body form", async () => {
    vi.stubEnv("AI_KEY_GROQ", "grq");
    mockFetch.mockResolvedValueOnce(okResponse(EXTRACTION_JSON));

    await handler(
      proxyReq(
        {
          providerId: "groq",
          imageBase64: "data:image/png;base64,ZZZZ",
          prompt: "compact-prompt",
          mimeType: "image/png",
        }
      )
    );

    const [, init] = mockFetch.mock.calls[0];
    const sentBody = JSON.parse(init.body);
    const imagePart = sentBody.messages[0].content.find(
      (c: { type: string }) => c.type === "image_url"
    );
    expect(imagePart.image_url.url).toBe("data:image/png;base64,ZZZZ");
    expect(sentBody.imageBase64).toBeUndefined();
    expect(sentBody.prompt).toBeUndefined();
  });
});
