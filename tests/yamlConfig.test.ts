import { describe, it, expect } from "vitest";
import { parseSimpleYaml } from "../src/yamlConfig";

describe("parseSimpleYaml", () => {
  it("parses simple key-value pairs", () => {
    const result = parseSimpleYaml("currency: EUR\nuseCoupons: true");
    expect(result.currency).toBe("EUR");
    expect(result.useCoupons).toBe("true");
  });

  it("ignores blank lines", () => {
    const result = parseSimpleYaml("\ncurrency: USD\n\nuseCoupons: false\n");
    expect(result.currency).toBe("USD");
    expect(result.useCoupons).toBe("false");
  });

  it("ignores comment lines starting with #", () => {
    const result = parseSimpleYaml("# this is a comment\ncurrency: GBP");
    expect(result.currency).toBe("GBP");
    expect(Object.keys(result)).not.toContain("# this is a comment");
  });

  it("parses nested map blocks", () => {
    const yaml = "aiApiKeys:\n  Gemini: my-key\n  Groq: other-key";
    const result = parseSimpleYaml(yaml);
    expect(typeof result.aiApiKeys).toBe("object");
    const keys = result.aiApiKeys as Record<string, string>;
    expect(keys.Gemini).toBe("my-key");
    expect(keys.Groq).toBe("other-key");
  });

  it("parses multiple nested blocks", () => {
    const yaml = "ocrApiKeys:\n  OcrSpace: ocr-key\naiApiKeys:\n  Gemini: gem-key";
    const result = parseSimpleYaml(yaml);
    expect((result.ocrApiKeys as Record<string, string>).OcrSpace).toBe("ocr-key");
    expect((result.aiApiKeys as Record<string, string>).Gemini).toBe("gem-key");
  });

  it("returns empty object for empty input", () => {
    expect(parseSimpleYaml("")).toEqual({});
  });

  it("returns empty object for only comments", () => {
    expect(parseSimpleYaml("# comment\n# another")).toEqual({});
  });

  it("handles Windows CRLF line endings", () => {
    const result = parseSimpleYaml("currency: JPY\r\nuseCoupons: false");
    expect(result.currency).toBe("JPY");
  });

  it("parses numeric values as strings", () => {
    const result = parseSimpleYaml("couponValue: 10.5");
    expect(result.couponValue).toBe("10.5");
  });

  it("parses boolean-like values as strings", () => {
    const result = parseSimpleYaml("useOcr: true");
    expect(result.useOcr).toBe("true");
  });

  it("last nested block is flushed at EOF", () => {
    const yaml = "keys:\n  A: val-a";
    const result = parseSimpleYaml(yaml);
    expect((result.keys as Record<string, string>).A).toBe("val-a");
  });
});
