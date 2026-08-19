export const IMAGE_EXTRACTION_PROMPT = `Read this retail image and return only valid JSON with exactly these keys:
{
  "product_name": "string or null",
  "price": 0.00,
  "currency": "EUR or USD or GBP or another ISO-4217 code, or null",
  "price_type": "unit_price|discount_price|price_per_unit|other",
  "confidence": 0.00,
  "uncertain": false
}

Rules:
- Choose one best product and its current selling price; prefer a discounted price over an old/crossed-out price.
- Parse 1.234,56 and 1,234.56 as JSON numbers with a dot.
- Use null product/currency and price null when no usable price is visible; then set \`price_type: "other"\`, \`confidence: 0\`, \`uncertain: true\`.
- No Markdown, prose, OCR, bounding boxes, IDs, notes, or extra keys.`;

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
  raw_text?: string;
  normalized: number;
  currency: string | null;
  confidence: number;
  type: AiPriceType;
  bounding_box?: AiBoundingBox;
  notes?: string;
}

export interface AiNameCandidate {
  text: string;
  confidence: number;
}

export interface AiProduct {
  id?: string;
  name: string | null;
  name_confidence?: number;
  name_raw?: string;
  name_candidates?: AiNameCandidate[];
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

const COMPACT_PRICE_TYPES = new Set<AiPriceType>([
  "unit_price",
  "discount_price",
  "price_per_unit",
  "other",
]);

interface CompactExtractionResult {
  product_name: string | null;
  price: number | null;
  currency: string | null;
  price_type: AiPriceType;
  confidence: number;
  uncertain: boolean;
}

function isCompactExtractionShape(value: unknown): value is CompactExtractionResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (typeof v.product_name === "string" || v.product_name === null) &&
    (typeof v.price === "number" || v.price === null) &&
    (typeof v.currency === "string" || v.currency === null) &&
    typeof v.price_type === "string" &&
    COMPACT_PRICE_TYPES.has(v.price_type as AiPriceType) &&
    typeof v.confidence === "number" &&
    Number.isFinite(v.confidence) &&
    typeof v.uncertain === "boolean"
  );
}

function normalizeExtraction(value: AiExtractionResult | CompactExtractionResult): AiExtractionResult {
  if (isExtractionShape(value)) return value;
  if (value.price === null || !Number.isFinite(value.price)) {
    return {
      version: "1.0",
      products: [],
      image_text: "",
      metadata: { processing_ms: 0, model: "auto:vision" },
      warnings: [],
      uncertain: true,
    };
  }
  return {
    version: "1.0",
    products: [
      {
        name: value.product_name,
        prices: [
          {
            normalized: value.price,
            currency: value.currency,
            confidence: value.confidence,
            type: value.price_type,
          },
        ],
      },
    ],
    image_text: "",
    metadata: { processing_ms: 0, model: "auto:vision" },
    warnings: [],
    uncertain: value.uncertain,
  };
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

  if (!isExtractionShape(parsed) && !isCompactExtractionShape(parsed)) {
    throw new AiExtractionError("schema_mismatch", "missing required keys: version, products[]");
  }

  return normalizeExtraction(parsed);
}

// Safe-for-logs diagnostics for a parse failure. It intentionally reports
// structure only and never includes product names, prices, OCR, or prompts.
export function getUnparseableTextDiagnostics(raw: string): string {
  const trimmed = raw.trim();
  const startsWithFence = /^```(?:json)?\s*/i.test(trimmed);
  const endsWithFence = /```\s*$/i.test(trimmed);
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  const hasCompleteObject = firstBrace >= 0 && lastBrace > firstBrace;
  const likelyTruncated = startsWithFence && !endsWithFence;
  return [
    `length=${trimmed.length}`,
    `startsWithFence=${startsWithFence}`,
    `endsWithFence=${endsWithFence}`,
    `hasCompleteObject=${hasCompleteObject}`,
    `likelyTruncated=${likelyTruncated}`,
  ].join("; ");
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
