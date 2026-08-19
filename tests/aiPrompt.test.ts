import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IMAGE_EXTRACTION_PROMPT,
  getUnparseableTextDiagnostics,
  parseAiExtractionJson,
  toPriceItems,
  AiExtractionError,
  type AiExtractionResult,
} from "../src/aiPrompt";

const FIXTURES_DIR = join(__dirname, "fixtures", "ai");

function loadFixture(name: string): AiExtractionResult {
  const raw = readFileSync(join(FIXTURES_DIR, name), "utf8");
  return JSON.parse(raw) as AiExtractionResult;
}

describe("IMAGE_EXTRACTION_PROMPT", () => {
 it("requests the compact item extraction contract", () => {
   expect(IMAGE_EXTRACTION_PROMPT).toContain('"product_name"');
   expect(IMAGE_EXTRACTION_PROMPT).toContain('"price"');
   expect(IMAGE_EXTRACTION_PROMPT).toContain('"currency"');
   expect(IMAGE_EXTRACTION_PROMPT).toContain('"price_type"');
   expect(IMAGE_EXTRACTION_PROMPT).not.toContain("image_text");
   expect(IMAGE_EXTRACTION_PROMPT).not.toContain("bounding_box");
   expect(IMAGE_EXTRACTION_PROMPT).not.toContain("name_candidates");
 });

 it("requires JSON only and prioritizes the current price", () => {
   expect(IMAGE_EXTRACTION_PROMPT).toContain("return only valid JSON");
   expect(IMAGE_EXTRACTION_PROMPT).toContain("current selling price");
   expect(IMAGE_EXTRACTION_PROMPT).toContain("prefer a discounted price");
 });
});

describe("parseAiExtractionJson", () => {
  const sample = loadFixture("single-price.json");
  const sampleStr = JSON.stringify(sample);

  it("parses raw JSON", () => {
    const result = parseAiExtractionJson(sampleStr);
    expect(result.version).toBe("1.0");
    expect(result.products).toHaveLength(1);
  });

  it("strips ```json fenced code blocks", () => {
    const fenced = "```json\n" + sampleStr + "\n```";
    const result = parseAiExtractionJson(fenced);
    expect(result.products[0].name).toBe("Latte Intero 1L");
  });

  it("strips plain ``` fenced code blocks", () => {
    const fenced = "```\n" + sampleStr + "\n```";
    const result = parseAiExtractionJson(fenced);
    expect(result.products).toHaveLength(1);
  });

  it("unwraps OpenAI-style envelope { choices:[{ message:{ content } }] }", () => {
    const envelope = JSON.stringify({
      choices: [{ message: { content: sampleStr } }],
    });
    const result = parseAiExtractionJson(envelope);
    expect(result.version).toBe("1.0");
  });

  it("unwraps OpenAI envelope with fenced content", () => {
    const envelope = JSON.stringify({
      choices: [{ message: { content: "```json\n" + sampleStr + "\n```" } }],
    });
    const result = parseAiExtractionJson(envelope);
    expect(result.products[0].name).toBe("Latte Intero 1L");
  });

  it("unwraps Responses-style envelope { output_text }", () => {
    const envelope = JSON.stringify({ output_text: sampleStr });
    const result = parseAiExtractionJson(envelope);
    expect(result.version).toBe("1.0");
  });

  it("unwraps the AI gateway ChatResponse { text } envelope", () => {
    const envelope = JSON.stringify({
      provider: "gateway-provider",
      model: "auto:vision",
      text: sampleStr,
    });
    const result = parseAiExtractionJson(envelope);
    expect(result.products[0].name).toBe("Latte Intero 1L");
  });

  it("normalizes the compact single-item response used by the vision prompt", () => {
    const compact = JSON.stringify({
      product_name: "Latte Intero 1L",
      price: 1.99,
      currency: "EUR",
      price_type: "unit_price",
      confidence: 0.97,
      uncertain: false,
    });
    const result = parseAiExtractionJson(compact);
    expect(result).toMatchObject({
      version: "1.0",
      uncertain: false,
      products: [
        {
          name: "Latte Intero 1L",
          prices: [
            {
              normalized: 1.99,
              currency: "EUR",
              type: "unit_price",
              confidence: 0.97,
            },
          ],
        },
      ],
    });
  });

  it("normalizes a compact gateway text envelope", () => {
    const envelope = JSON.stringify({
      text: JSON.stringify({
        product_name: "Pane",
        price: 2.5,
        currency: "EUR",
        price_type: "unit_price",
        confidence: 0.8,
        uncertain: false,
      }),
    });
    const result = parseAiExtractionJson(envelope);
    expect(result.products[0]?.prices[0]?.normalized).toBe(2.5);
  });

  it("returns no products when the compact response has no usable price", () => {
    const compact = JSON.stringify({
      product_name: null,
      price: null,
      currency: null,
      price_type: "other",
      confidence: 0,
      uncertain: true,
    });
    const result = parseAiExtractionJson(compact);
    expect(result.products).toEqual([]);
    expect(result.uncertain).toBe(true);
  });

  it("recovers JSON wrapped in a fence with surrounding prose", () => {
    const withProse =
      "Sure, here is the extraction result:\n```json\n" +
      sampleStr +
      "\n```\nLet me know if you need anything else.";
    const result = parseAiExtractionJson(withProse);
    expect(result.products[0].name).toBe("Latte Intero 1L");
  });

  it("recovers a bare JSON object surrounded by prose without fences", () => {
    const withProse = "Here you go: " + sampleStr + " Hope that helps!";
    const result = parseAiExtractionJson(withProse);
    expect(result.version).toBe("1.0");
  });

  it("recovers the AI gateway envelope when its text field has prose around the JSON", () => {
    const envelope = JSON.stringify({
      text: "Result:\n```json\n" + sampleStr + "\n```",
    });
    const result = parseAiExtractionJson(envelope);
    expect(result.products[0].name).toBe("Latte Intero 1L");
  });

  it("throws AiExtractionError(invalid_json) on garbage", () => {
    expect.assertions(2);
    try {
      parseAiExtractionJson("not json at all {{{");
    } catch (e) {
      expect(e).toBeInstanceOf(AiExtractionError);
      expect((e as AiExtractionError).code).toBe("invalid_json");
    }
  });

  it("throws AiExtractionError(empty) on empty input", () => {
    expect.assertions(2);
    try {
      parseAiExtractionJson("   ");
    } catch (e) {
      expect(e).toBeInstanceOf(AiExtractionError);
      expect((e as AiExtractionError).code).toBe("empty");
    }
  });

  it("throws AiExtractionError(schema_mismatch) when products array is missing", () => {
    expect.assertions(2);
    try {
      parseAiExtractionJson(JSON.stringify({ version: "1.0" }));
    } catch (e) {
      expect(e).toBeInstanceOf(AiExtractionError);
      expect((e as AiExtractionError).code).toBe("schema_mismatch");
    }
  });

  it("throws AiExtractionError(schema_mismatch) when version is missing", () => {
    expect.assertions(2);
    try {
      parseAiExtractionJson(JSON.stringify({ products: [] }));
    } catch (e) {
      expect(e).toBeInstanceOf(AiExtractionError);
      expect((e as AiExtractionError).code).toBe("schema_mismatch");
    }
  });
});

describe("getUnparseableTextDiagnostics", () => {
  it("reports structure without including extracted content", () => {
    const diagnostics = getUnparseableTextDiagnostics("hello product 1.99");
    expect(diagnostics).toContain("length=");
    expect(diagnostics).not.toContain("hello");
    expect(diagnostics).not.toContain("1.99");
  });

  it("identifies an unterminated Markdown JSON fence as likely truncation", () => {
    const diagnostics = getUnparseableTextDiagnostics("```json\n{\"product_name\":\"hidden\"");
    expect(diagnostics).toContain("startsWithFence=true");
    expect(diagnostics).toContain("endsWithFence=false");
    expect(diagnostics).toContain("likelyTruncated=true");
  });
});

describe("toPriceItems", () => {
  it("flattens single-price fixture to 1 EUR item @ 1.99", () => {
    const result = parseAiExtractionJson(
      JSON.stringify(loadFixture("single-price.json"))
    );
    const items = toPriceItems(result);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      productName: "Latte Intero 1L",
      price: 1.99,
      currency: "EUR",
      source: "ai",
      type: "unit_price",
    });
  });

  it("flattens multi-price fixture to 3 items with correct types", () => {
    const result = parseAiExtractionJson(
      JSON.stringify(loadFixture("multi-price.json"))
    );
    const items = toPriceItems(result);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.type)).toEqual([
      "old_price",
      "discount_price",
      "price_per_unit",
    ]);
    expect(items.every((i) => i.currency === "EUR")).toBe(true);
    expect(items.every((i) => i.source === "ai")).toBe(true);
  });

  it("flattens EU-locale fixture to 1 EUR item @ 1234.56", () => {
    const result = parseAiExtractionJson(
      JSON.stringify(loadFixture("locale-eu.json"))
    );
    const items = toPriceItems(result);
    expect(items).toHaveLength(1);
    expect(items[0].price).toBe(1234.56);
    expect(items[0].currency).toBe("EUR");
  });

  it("flattens US-locale fixture to 1 USD item @ 1234.56", () => {
    const result = parseAiExtractionJson(
      JSON.stringify(loadFixture("locale-us.json"))
    );
    const items = toPriceItems(result);
    expect(items).toHaveLength(1);
    expect(items[0].price).toBe(1234.56);
    expect(items[0].currency).toBe("USD");
  });

  it("flattens uncertain fixture: null name, null currency preserved", () => {
    const result = parseAiExtractionJson(
      JSON.stringify(loadFixture("uncertain.json"))
    );
    expect(result.uncertain).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    const items = toPriceItems(result);
    expect(items).toHaveLength(1);
    expect(items[0].productName).toBeNull();
    expect(items[0].currency).toBeNull();
    expect(items[0].price).toBe(0.99);
  });
});
