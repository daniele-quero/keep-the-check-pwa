export const IMAGE_EXTRACTION_PROMPT = `You are a precision visual-text extractor for retail images (price tags, shelf labels, packaging). Analyze the provided image and return ONLY valid JSON that exactly matches the schema below. Do NOT add narrative, explanation, or logs. Use visual layout + OCR to identify product name(s) and all price-like values. Normalize numbers and currencies. Include confidence scores (0.00–1.00). Provide bounding boxes in pixel coordinates relative to the original image. If uncertain, include an explanation in \`notes\` and set \`uncertain: true\`. Follow these rules precisely:
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
(Strict rules: \`products\` may be empty array if none detected; return numeric \`normalized\` as float; \`currency\` must be ISO code or \`null\` if unknown.)`;

export interface AiBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AiPriceType =
  | "unit_price"
  | "total_price"
  | "discount_price"
  | "old_price"
  | "price_per_unit"
  | "other";

export interface AiPrice {
  raw_text: string;
  normalized: number;
  currency: string | null;
  confidence: number;
  type: AiPriceType;
  bounding_box: AiBoundingBox;
  notes?: string;
}

export interface AiNameCandidate {
  text: string;
  confidence: number;
}

export interface AiProduct {
  id: string;
  name: string | null;
  name_confidence: number;
  name_raw: string;
  name_candidates: AiNameCandidate[];
  prices: AiPrice[];
  notes?: string;
}

export interface AiExtractionMetadata {
  processing_ms: number;
  model: string;
}

export interface AiExtractionResult {
  version: string;
  products: AiProduct[];
  image_text: string;
  metadata: AiExtractionMetadata;
  warnings: string[];
  uncertain: boolean;
}

export type AiExtractionErrorCode =
  | "invalid_json"
  | "schema_mismatch"
  | "empty"
  | "http_error"
  | "timeout"
  | "network";

export class AiExtractionError extends Error {
  public readonly code: AiExtractionErrorCode;
  constructor(code: AiExtractionErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AiExtractionError";
    this.code = code;
  }
}

const FENCE_RE = /^\s*```(?:json|JSON)?\s*\n([\s\S]*?)\n?```\s*$/;

function stripFences(text: string): string {
  const m = text.match(FENCE_RE);
  return m ? m[1] : text;
}

function unwrapEnvelope(value: unknown): string | unknown {
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.output_text === "string") {
      return v.output_text;
    }
    if (Array.isArray(v.choices) && v.choices.length > 0) {
      const first = v.choices[0] as Record<string, unknown> | undefined;
      const message = first && (first.message as Record<string, unknown> | undefined);
      if (message && typeof message.content === "string") {
        return message.content;
      }
    }
  }
  return value;
}

function isExtractionShape(value: unknown): value is AiExtractionResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.version === "string" && Array.isArray(v.products);
}

export function parseAiExtractionJson(raw: string): AiExtractionResult {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new AiExtractionError("empty", "input is empty");
  }

  const trimmed = raw.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const stripped = stripFences(trimmed).trim();
    try {
      parsed = JSON.parse(stripped);
    } catch {
      throw new AiExtractionError("invalid_json", "input is not valid JSON");
    }
  }

  // Unwrap envelope shapes up to two times (envelope -> string -> object).
  for (let i = 0; i < 2; i++) {
    if (isExtractionShape(parsed)) break;
    const unwrapped = unwrapEnvelope(parsed);
    if (typeof unwrapped === "string") {
      const inner = stripFences(unwrapped).trim();
      if (inner.length === 0) {
        throw new AiExtractionError("empty", "envelope content is empty");
      }
      try {
        parsed = JSON.parse(inner);
      } catch {
        throw new AiExtractionError("invalid_json", "envelope content is not valid JSON");
      }
    } else if (unwrapped !== parsed) {
      parsed = unwrapped;
    } else {
      break;
    }
  }

  if (!isExtractionShape(parsed)) {
    throw new AiExtractionError("schema_mismatch", "missing required keys: version, products[]");
  }

  return parsed;
}

export interface FlattenedPriceItem {
  productName: string | null;
  price: number;
  currency: string | null;
  confidence: number;
  type: string;
  source: "ai";
}

export function toPriceItems(result: AiExtractionResult): FlattenedPriceItem[] {
  const out: FlattenedPriceItem[] = [];
  for (const product of result.products) {
    for (const price of product.prices) {
      out.push({
        productName: product.name,
        price: price.normalized,
        currency: price.currency,
        confidence: price.confidence,
        type: price.type,
        source: "ai",
      });
    }
  }
  return out;
}
