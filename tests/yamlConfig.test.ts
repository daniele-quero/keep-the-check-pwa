import { describe, it, expect } from "vitest";
import { parseSimpleYaml, exportConfigYaml } from "../src/yamlConfig";

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
    const yaml = "someMap:\n  alpha: my-val\n  beta: other-val";
    const result = parseSimpleYaml(yaml);
    expect(typeof result.someMap).toBe("object");
    const keys = result.someMap as Record<string, string>;
    expect(keys.alpha).toBe("my-val");
    expect(keys.beta).toBe("other-val");
  });

  it("parses multiple nested blocks", () => {
    const yaml = "firstMap:\n  k1: v1\nsecondMap:\n  k2: v2";
    const result = parseSimpleYaml(yaml);
    expect((result.firstMap as Record<string, string>).k1).toBe("v1");
    expect((result.secondMap as Record<string, string>).k2).toBe("v2");
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
    const result = parseSimpleYaml("useCoupons: true");
    expect(result.useCoupons).toBe("true");
  });

  it("last nested block is flushed at EOF", () => {
    const yaml = "keys:\n  A: val-a";
    const result = parseSimpleYaml(yaml);
    expect((result.keys as Record<string, string>).A).toBe("val-a");
  });

  it("parses AI image analysis fields", () => {
    const yaml = [
      "aiEndpoint: https://api.example.com/v1/chat",
      "aiModel: gpt-4o-mini",
      "aiTimeoutMs: 45000",
      "aiUseProxy: true",
      "requireManualConfirm: false",
    ].join("\n");
    const result = parseSimpleYaml(yaml);
    expect(result.aiEndpoint).toBe("https://api.example.com/v1/chat");
    expect(result.aiModel).toBe("gpt-4o-mini");
    expect(result.aiTimeoutMs).toBe("45000");
    expect(result.aiUseProxy).toBe("true");
    expect(result.requireManualConfirm).toBe("false");
  });
});

describe("exportConfigYaml", () => {
  const baseCfg = {
    currency: "EUR",
    useCoupons: false,
    couponValue: 0,
    couponAlertThreshold: 0.2,
    aiEndpoint: "https://api.example.com/v1/chat",
    aiModel: "gpt-4o-mini",
    aiApiKey: "super-secret-image-key",
    aiTimeoutMs: 45000,
    aiUseProxy: true,
    requireManualConfirm: false,
  };

  it("includes the new AI image fields in the output", () => {
    const yml = exportConfigYaml(baseCfg);
    expect(yml).toContain("aiEndpoint: https://api.example.com/v1/chat");
    expect(yml).toContain("aiModel: gpt-4o-mini");
    expect(yml).toContain("aiTimeoutMs: 45000");
    expect(yml).toContain("aiUseProxy: true");
    expect(yml).toContain("requireManualConfirm: false");
  });

  it("strips the aiApiKey value from exported YAML to prevent leaking secrets", () => {
    const yml = exportConfigYaml(baseCfg);
    expect(yml).not.toContain("super-secret-image-key");
    expect(yml).toMatch(/aiApiKey:\s*""/);
  });

  it("round-trips the non-secret AI fields through parseSimpleYaml", () => {
    const yml = exportConfigYaml(baseCfg);
    const parsed = parseSimpleYaml(yml);
    expect(parsed.aiEndpoint).toBe(baseCfg.aiEndpoint);
    expect(parsed.aiModel).toBe(baseCfg.aiModel);
    expect(parsed.aiTimeoutMs).toBe(String(baseCfg.aiTimeoutMs));
    expect(parsed.aiUseProxy).toBe("true");
    expect(parsed.requireManualConfirm).toBe("false");
  });
});
