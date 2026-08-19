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

// Matches a fenced code block anywhere in the text (not anchored to the
// whole string), so preamble/trailing prose around the fence doesn't block
// extraction. e.g. "Sure, here you go:\n```json\n{...}\n```\nLet me know!"
const FENCE_RE = /```(?:json|JSON)?\s*\n?([\s\S]*?)```/;

function extractFencedJson(text: string): string | null {
  const m = text.match(FENCE_RE);
  const inner = m?.[1]?.trim();
  return inner && inner.length > 0 ? inner : null;
}

// Finds the first top-level JSON object in the text by counting brace depth,
// so a model's stray preamble/trailing commentary around a valid JSON object
// doesn't prevent extraction (e.g. "Here is the result: {...} Let me know.").
function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// Best-effort JSON.parse that tolerates markdown fences and stray prose
// wrapped around the actual JSON object, which some vision models emit
// despite being instructed to return raw JSON only.
function parseJsonLenient(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to fence/balanced-brace recovery below
  }

  const fenced = extractFencedJson(trimmed);
  if (fenced) {
    try {
      return JSON.parse(fenced);
    } catch {
      // fall through
    }
  }

  const balanced = extractBalancedJson(trimmed);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch {
      // fall through
    }
  }

  throw new AiExtractionError("invalid_json", "input is not valid JSON");
}

function unwrapEnvelope(value: unknown): string | unknown {
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.output_text === "string") {
      return v.output_text;
    }
    if (typeof v.text === "string") {
      return v.text;
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

  let parsed: unknown = parseJsonLenient(raw);

  // Unwrap envelope shapes up to two times (envelope -> string -> object).
  for (let i = 0; i < 2; i++) {
    if (isExtractionShape(parsed)) break;
    const unwrapped = unwrapEnvelope(parsed);
    if (typeof unwrapped === "string") {
      if (unwrapped.trim().length === 0) {
        throw new AiExtractionError("empty", "envelope content is empty");
      }
      parsed = parseJsonLenient(unwrapped);
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

// Best-effort, safe-for-logs preview of what the gateway/model actually
// returned when parsing fails. Only used for diagnostics: it never throws
// and never returns more than a short prefix/suffix, so it can't leak an
// entire extracted receipt (product names/prices) into Netlify logs.
export function previewUnparseableText(raw: string, maxLen = 160): string {
  try {
    let text = raw;
    const parsed = JSON.parse(raw);
    const unwrapped = unwrapEnvelope(parsed);
    if (typeof unwrapped === "string") text = unwrapped;
    const trimmed = text.trim();
    if (trimmed.length <= maxLen * 2) return trimmed;
    return `${trimmed.slice(0, maxLen)}…[${trimmed.length - maxLen * 2} chars omitted]…${trimmed.slice(-maxLen)}`;
  } catch {
    const trimmed = raw.trim();
    if (trimmed.length <= maxLen * 2) return trimmed;
    return `${trimmed.slice(0, maxLen)}…[${trimmed.length - maxLen * 2} chars omitted]…${trimmed.slice(-maxLen)}`;
  }
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
