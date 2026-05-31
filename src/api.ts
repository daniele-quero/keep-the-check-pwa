import {
  AiExtractionError,
  parseAiExtractionJson,
  type AiExtractionResult,
} from "./aiPrompt";

export interface SendImageToAIOptions {
  endpoint: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  useProxy?: boolean;
  extraHeaders?: Record<string, string>;
}

const DEFAULT_AI_TIMEOUT_MS = 30000;
const DATA_URL_PREFIX_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;

export async function sendImageToAI(
  imageBase64: string,
  prompt: string,
  opts: SendImageToAIOptions
): Promise<AiExtractionResult> {
  const rawBase64 = imageBase64.replace(DATA_URL_PREFIX_RE, "");
  const timeoutMs = opts.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", onExternalAbort, { once: true });
  }
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.apiKey && opts.useProxy !== true) {
    headers["Authorization"] = `Bearer ${opts.apiKey}`;
  }
  if (opts.extraHeaders) {
    Object.assign(headers, opts.extraHeaders);
  }

  const body: Record<string, unknown> = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${rawBase64}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };
  if (opts.model) {
    body.model = opts.model;
  }

  let res: Response;
  try {
    res = await fetch(opts.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (opts.signal) opts.signal.removeEventListener("abort", onExternalAbort);
    const name = (err as { name?: string } | null)?.name;
    if (name === "AbortError") {
      throw new AiExtractionError("timeout", `request aborted (timeout ${timeoutMs}ms)`);
    }
    throw new AiExtractionError(
      "network",
      err instanceof Error ? err.message : "network error"
    );
  }

  clearTimeout(timeoutHandle);
  if (opts.signal) opts.signal.removeEventListener("abort", onExternalAbort);

  if (!res.ok) {
    throw new AiExtractionError(
      "http_error",
      `HTTP ${res.status}: ${res.statusText ?? ""}`.trim()
    );
  }

  const text = await res.text();
  return parseAiExtractionJson(text);
}
