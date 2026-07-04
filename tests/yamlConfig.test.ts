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

  it("parses coupon and confirm fields", () => {
    const yaml = [
      "useCoupons: true",
      "couponValue: 5.00",
      "couponAlertThreshold: 0.15",
      "requireManualConfirm: false",
    ].join("\n");
    const result = parseSimpleYaml(yaml);
    expect(result.useCoupons).toBe("true");
    expect(result.couponValue).toBe("5.00");
    expect(result.couponAlertThreshold).toBe("0.15");
    expect(result.requireManualConfirm).toBe("false");
  });
});

describe("exportConfigYaml", () => {
  const baseCfg = {
    currency: "EUR",
    useCoupons: false,
    couponValue: 0,
    couponAlertThreshold: 0.2,
    requireManualConfirm: false,
  };

  it("includes the non-secret config fields in the output", () => {
    const yml = exportConfigYaml(baseCfg);
    expect(yml).toContain("currency: EUR");
    expect(yml).toContain("useCoupons: false");
    expect(yml).toContain("couponValue: 0.00");
    expect(yml).toContain("couponAlertThreshold: 0.2");
    expect(yml).toContain("requireManualConfirm: false");
  });

  it("never emits any AI endpoint, model or key fields", () => {
    const yml = exportConfigYaml(baseCfg);
    expect(yml).not.toContain("aiEndpoint");
    expect(yml).not.toContain("aiModel");
    expect(yml).not.toContain("aiApiKey");
    expect(yml).not.toContain("aiUseProxy");
    expect(yml).not.toContain("aiTimeoutMs");
  });

  it("round-trips the non-secret fields through parseSimpleYaml", () => {
    const yml = exportConfigYaml(baseCfg);
    const parsed = parseSimpleYaml(yml);
    expect(parsed.currency).toBe("EUR");
    expect(parsed.requireManualConfirm).toBe("false");
    expect(parsed.couponAlertThreshold).toBe("0.2");
  });
});
