import { describe, it, expect, vi, beforeEach } from "vitest";
import { recognizeOcr, parseWithGemini, parseWithGroq } from "../src/api";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("recognizeOcr", () => {
  it("returns parsed text on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ParsedResults: [{ ParsedText: "Product A 5.99\nProduct B 3.50" }],
        OCRExitCode: 1,
        IsErroredOnProcessing: false,
      }),
    });

    const result = await recognizeOcr("base64data", "test-key");
    expect(result).toBe("Product A 5.99\nProduct B 3.50");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.ocr.space/parse/image");
    expect(options.method).toBe("POST");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    await expect(recognizeOcr("data", "key")).rejects.toThrow("OCR HTTP 403");
  });

  it("throws on OCR processing error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ParsedResults: [],
        OCRExitCode: 2,
        IsErroredOnProcessing: true,
        ErrorMessage: "Invalid key",
      }),
    });

    await expect(recognizeOcr("data", "key")).rejects.toThrow("OCR error: Invalid key");
  });

  it("throws on empty results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ParsedResults: [],
        OCRExitCode: 1,
        IsErroredOnProcessing: false,
      }),
    });

    await expect(recognizeOcr("data", "key")).rejects.toThrow("OCR: no results");
  });
});

describe("parseWithGemini", () => {
  it("returns parsed prices on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: '{"items":[{"product":"Apple","price":1.99}]}' }],
          },
        }],
      }),
    });

    const result = await parseWithGemini("Apple 1.99", "gemini-key");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].product).toBe("Apple");
    expect(result.items[0].price).toBe(1.99);
  });

  it("handles markdown-wrapped JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: '```json\n{"items":[{"product":"Bread","price":2.50}]}\n```' }],
          },
        }],
      }),
    });

    const result = await parseWithGemini("Bread 2.50", "key");
    expect(result.items[0].product).toBe("Bread");
    expect(result.items[0].price).toBe(2.50);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });

    await expect(parseWithGemini("text", "key")).rejects.toThrow("Gemini HTTP 429");
  });

  it("throws on empty candidates", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [] }),
    });

    await expect(parseWithGemini("text", "key")).rejects.toThrow("Gemini: no response");
  });

  it("throws on null content", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: null }],
      }),
    });

    await expect(parseWithGemini("text", "key")).rejects.toThrow("Gemini: no response");
  });

  it("throws on malformed JSON from AI", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: "not json at all" }] },
        }],
      }),
    });

    await expect(parseWithGemini("text", "key")).rejects.toThrow("AI returned invalid JSON");
  });

  it("throws on empty items array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: '{"items":[]}' }] },
        }],
      }),
    });

    await expect(parseWithGemini("text", "key")).rejects.toThrow("AI: no prices recognized");
  });
});

describe("parseWithGroq", () => {
  it("returns parsed prices on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '{"items":[{"product":"Milk","price":1.20}]}',
          },
        }],
      }),
    });

    const result = await parseWithGroq("Milk 1.20", "groq-key");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].product).toBe("Milk");
    expect(result.items[0].price).toBe(1.20);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer groq-key");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(parseWithGroq("text", "key")).rejects.toThrow("Groq HTTP 500");
  });

  it("throws on empty choices", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [] }),
    });

    await expect(parseWithGroq("text", "key")).rejects.toThrow("Groq: no response");
  });

  it("throws on null message content", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: null } }],
      }),
    });

    await expect(parseWithGroq("text", "key")).rejects.toThrow("Groq: no response");
  });
});
