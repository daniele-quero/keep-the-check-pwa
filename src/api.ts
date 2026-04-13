import { PriceResult } from "./models";

const OCR_ENDPOINT = "https://api.ocr.space/parse/image";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const PROMPT =
  "Analyze the following text extracted via OCR from a price tag or receipt. " +
  "Identify all prices (as numbers) and the associated product name. " +
  'If the product name is not recognizable, use "UNKNOWN" as placeholder. ' +
  "Ignore any text reporting 'price per weight' values. " +
  "Respond ONLY with a valid JSON object in this exact format, no markdown, no explanation:\n" +
  '{"items":[{"product":"product name","price":0.00}]}\n\n' +
  "OCR text:\n";

export interface OcrOptions {
  engine?: string;
  isTable?: boolean;
}

export async function recognizeOcr(
  base64: string,
  apiKey: string,
  language = "ita",
  options: OcrOptions = {}
): Promise<string> {
  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("base64Image", `data:image/jpeg;base64,${base64}`);
  form.append("language", language);
  form.append("isOverlayRequired", "false");
  form.append("OCREngine", options.engine ?? "1");
  if (options.isTable) {
    form.append("isTable", "true");
  }

  const res = await fetch(OCR_ENDPOINT, { method: "POST", body: form });
  if (!res.ok) throw new Error(`OCR HTTP ${res.status}: ${res.statusText}`);

  const data = await res.json();

  if (data.IsErroredOnProcessing || data.OCRExitCode !== 1) {
    throw new Error(`OCR error: ${data.ErrorMessage ?? "unknown"}`);
  }

  if (!data.ParsedResults || data.ParsedResults.length === 0) {
    throw new Error("OCR: no results");
  }

  return data.ParsedResults[0].ParsedText as string;
}

export async function parseWithGemini(
  ocrText: string,
  apiKey: string
): Promise<PriceResult> {
  const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT + ocrText }] }],
    }),
  });

  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${res.statusText}`);

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: no response content");

  return cleanAndParse(text);
}

export async function parseWithGroq(
  ocrText: string,
  apiKey: string
): Promise<PriceResult> {
  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      messages: [{ role: "user", content: PROMPT + ocrText }],
    }),
  });

  if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${res.statusText}`);

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq: no response content");

  return cleanAndParse(text);
}

function cleanAndParse(text: string): PriceResult {
  const clean = text
    .trim()
    .replace(/^```json\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`AI returned invalid JSON: ${clean.substring(0, 100)}`);
  }

  const result = parsed as PriceResult;
  if (!result?.items || !Array.isArray(result.items) || result.items.length === 0) {
    throw new Error("AI: no prices recognized");
  }

  return result;
}
