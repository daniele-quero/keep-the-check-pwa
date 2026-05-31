import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IMAGE_EXTRACTION_PROMPT,
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
  it("matches the verbatim canonical string", () => {
    expect(IMAGE_EXTRACTION_PROMPT).toBe(`You are a precision visual-text extractor for retail images (price tags, shelf labels, packaging). Analyze the provided image and return ONLY valid JSON that exactly matches the schema below. Do NOT add narrative, explanation, or logs. Use visual layout + OCR to identify product name(s) and all price-like values. Normalize numbers and currencies. Include confidence scores (0.00–1.00). Provide bounding boxes in pixel coordinates relative to the original image. If uncertain, include an explanation in \`notes\` and set \`uncertain: true\`. Follow these rules precisely:
- Detect every product-like label and each price-like text fragment.
- For product name: prefer large, centered, or bold text; if multiple candidates provide \`name_candidates\`.
- For prices: recognize currency symbols and names (€, EUR, $, USD, GBP, £, etc.) and local numeric formats (1.234,56 or 1,234.56). Normalize to a float using dot (\`normalized\`: 1.99) and supply \`currency\` as ISO-4217 code.
- Types: classify prices as \`unit_price\`, \`total_price\`, \`discount_price\`, \`old_price\`, \`price_per_unit\` when inferable.
- Bounding box format: \`{ "x": int, "y": int, "width": int, "height": int }\` in pixels.
- Confidence fields: two-decimal floats between 0.00 and 1.00.
- Output must be a single JSON object exactly matching the example schema; keys should not be renamed.

Example required JSON schema (strict):
{
  "version":"1.0",
  "products":[
    {
      "id":"p1",
      "name":"string|null",
      "name_confidence":0.00,
      "name_raw":"string",
      "name_candidates":[ { "text":"string", "confidence":0.00 } ],
      "prices":[
        {
          "raw_text":"string",
          "normalized":0.00,
          "currency":"EUR|USD|GBP|…",
          "confidence":0.00,
          "type":"unit_price|total_price|discount_price|old_price|price_per_unit|other",
          "bounding_box": { "x":0, "y":0, "width":0, "height":0 },
          "notes":"string"
        }
      ],
      "notes":"string"
    }
  ],
  "image_text":"full OCR text as single string",
  "metadata": { "processing_ms": 0, "model":"string" },
  "warnings":[ "string" ],
  "uncertain": false
}
(Strict rules: \`products\` may be empty array if none detected; return numeric \`normalized\` as float; \`currency\` must be ISO code or \`null\` if unknown.)`);
  });

  it("starts with 'You are' and ends with 'if unknown.)'", () => {
    expect(IMAGE_EXTRACTION_PROMPT.startsWith("You are")).toBe(true);
    expect(IMAGE_EXTRACTION_PROMPT.endsWith("if unknown.)")).toBe(true);
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
