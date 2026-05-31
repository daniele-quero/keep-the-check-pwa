import {
  AiExtractionError,
  parseAiExtractionJson,
  type AiExtractionResult,
} from "./aiPrompt";
import type { ProviderConfig } from "./config";

export interface SendImageToAIOptions {
  endpoint: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  useProxy?: boolean;
  extraHeaders?: Record<string, string>;
  aiProviders?: ProviderConfig[];
}

const DEFAULT_AI_TIMEOUT_MS = 30000;
const DATA_URL_PREFIX_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;
const ROUND_ROBIN_STORAGE_KEY = "aiProviderFallback.nextStartIndex";
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 120000;

type ProviderKind = "chat" | "replicate";

interface ResolvedProvider {
  id: string;
  name: string;
  kind: ProviderKind;
  endpoint: string;
  model: string;
  apiKey?: string;
  useProxy: boolean;
  timeoutMs: number;
  extraHeaders?: Record<string, string>;
  failureThreshold: number;
  cooldownMs: number;
}

interface ProviderRuntimeState {
  consecutiveFailures: number;
  blockedUntil: number;
}

const providerRuntime = new Map<string, ProviderRuntimeState>();

function normalizeBase64(imageBase64: string): string {
  return imageBase64.replace(DATA_URL_PREFIX_RE, "");
}

function resolveEndpointTemplate(endpointTemplate: string, model: string): string {
  return endpointTemplate.replace("{model}", encodeURIComponent(model));
}

function resolveProviderKind(providerId: string): ProviderKind {
  return providerId === "replicate" ? "replicate" : "chat";
}

function resolveProviders(opts: SendImageToAIOptions): ResolvedProvider[] {
  const configuredProviders = (opts.aiProviders ?? [])
    .filter(
      (provider) =>
        provider.enabled &&
        typeof provider.apiKey === "string" &&
        provider.apiKey.trim().length > 0
    )
    .sort((a, b) => a.priority - b.priority);

  if (configuredProviders.length > 0) {
    return configuredProviders.map((provider) => ({
      id: provider.id,
      name: provider.name,
      kind: resolveProviderKind(provider.id),
      endpoint: resolveEndpointTemplate(provider.endpointTemplate, provider.model),
      model: provider.model,
      apiKey: provider.apiKey,
      useProxy: provider.useProxy,
      timeoutMs: provider.timeoutMs ?? opts.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
      extraHeaders: provider.extraHeaders,
      failureThreshold: provider.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD,
      cooldownMs: provider.cooldownMs ?? DEFAULT_COOLDOWN_MS,
    }));
  }

  return [
    {
      id: "legacy",
      name: "legacy",
      kind: "chat",
      endpoint: opts.endpoint,
      model: opts.model ?? "",
      apiKey: opts.apiKey,
      useProxy: opts.useProxy === true,
      timeoutMs: opts.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
      extraHeaders: opts.extraHeaders,
      failureThreshold: 1,
      cooldownMs: 0,
    },
  ];
}

function getRoundRobinStartIndex(providerCount: number): number {
  if (providerCount <= 0 || typeof localStorage === "undefined") return 0;
  const raw = localStorage.getItem(ROUND_ROBIN_STORAGE_KEY);
  const parsed = raw ? parseInt(raw, 10) : 0;
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed % providerCount;
}

function setRoundRobinStartIndex(nextIndex: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ROUND_ROBIN_STORAGE_KEY, String(Math.max(0, nextIndex)));
}

function getAttemptOrder(providerCount: number, startIndex: number): number[] {
  const order: number[] = [];
  for (let i = 0; i < providerCount; i++) {
    order.push((startIndex + i) % providerCount);
  }
  return order;
}

function getRuntimeState(providerId: string): ProviderRuntimeState {
  const current = providerRuntime.get(providerId);
  if (current) return current;
  const initial = { consecutiveFailures: 0, blockedUntil: 0 };
  providerRuntime.set(providerId, initial);
  return initial;
}

function markProviderSuccess(providerId: string): void {
  providerRuntime.set(providerId, { consecutiveFailures: 0, blockedUntil: 0 });
}

function markProviderFailure(provider: ResolvedProvider): void {
  const state = getRuntimeState(provider.id);
  const consecutiveFailures = state.consecutiveFailures + 1;
  if (consecutiveFailures >= provider.failureThreshold) {
    providerRuntime.set(provider.id, {
      consecutiveFailures: 0,
      blockedUntil: Date.now() + provider.cooldownMs,
    });
    return;
  }
  providerRuntime.set(provider.id, {
    consecutiveFailures,
    blockedUntil: state.blockedUntil,
  });
}

function isProviderOnCooldown(providerId: string): boolean {
  const state = getRuntimeState(providerId);
  return state.blockedUntil > Date.now();
}

function buildHeaders(
  provider: ResolvedProvider,
  extraHeaders?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.apiKey && provider.useProxy !== true) {
    headers["Authorization"] =
      provider.kind === "replicate"
        ? `Token ${provider.apiKey}`
        : `Bearer ${provider.apiKey}`;
  }
  if (provider.extraHeaders) {
    Object.assign(headers, provider.extraHeaders);
  }
  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }
  return headers;
}

function buildBody(provider: ResolvedProvider, prompt: string, rawBase64: string): unknown {
  const imageUrl = `data:image/jpeg;base64,${rawBase64}`;

  if (provider.kind === "replicate") {
    const body: Record<string, unknown> = {
      input: {
        prompt,
        image: imageUrl,
      },
    };
    if (provider.model) {
      body.model = provider.model;
    }
    return body;
  }

  const body: Record<string, unknown> = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };

  if (provider.model) {
    body.model = provider.model;
  }

  return body;
}

function toAiError(err: unknown, timeoutMs: number): AiExtractionError {
  if (err instanceof AiExtractionError) return err;
  const name = (err as { name?: string } | null)?.name;
  if (name === "AbortError") {
    return new AiExtractionError("timeout", `request aborted (timeout ${timeoutMs}ms)`);
  }
  return new AiExtractionError(
    "network",
    err instanceof Error ? err.message : "network error"
  );
}

async function postJson(
  endpoint: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw toAiError(err, timeoutMs);
  } finally {
    clearTimeout(timeoutHandle);
    if (signal) signal.removeEventListener("abort", onExternalAbort);
  }
}

async function extractResponseText(provider: ResolvedProvider, res: Response): Promise<string> {
  const text = await res.text();
  if (provider.kind !== "replicate") return text;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }

  if (!parsed || typeof parsed !== "object") return text;
  const payload = parsed as Record<string, unknown>;
  const output = payload.output;

  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const firstString = output.find((entry) => typeof entry === "string");
    if (typeof firstString === "string") return firstString;
    if (output.length > 0) return JSON.stringify(output[0]);
  }
  if (output && typeof output === "object") {
    return JSON.stringify(output);
  }

  return text;
}

function extractHttpStatus(err: AiExtractionError): number | null {
  const match = err.message.match(/HTTP\s+(\d+)/i);
  if (!match) return null;
  const status = parseInt(match[1], 10);
  return Number.isFinite(status) ? status : null;
}

function isTransientError(err: AiExtractionError): boolean {
  if (err.code === "network" || err.code === "timeout") return true;
  if (err.code === "invalid_json" || err.code === "schema_mismatch" || err.code === "empty") {
    return true;
  }
  if (err.code !== "http_error") return false;

  const status = extractHttpStatus(err);
  if (status === null) return true;
  if (status === 429) return true;
  return status >= 500;
}

function formatProviderError(provider: ResolvedProvider, err: AiExtractionError): string {
  return `${provider.id}: ${err.code} (${err.message})`;
}

export async function sendImageToAI(
  imageBase64: string,
  prompt: string,
  opts: SendImageToAIOptions
): Promise<AiExtractionResult> {
  const rawBase64 = normalizeBase64(imageBase64);
  const providers = resolveProviders(opts);

  if (providers.length === 0) {
    throw new AiExtractionError("network", "no providers configured");
  }

  const hasConfiguredProviders = (opts.aiProviders ?? []).some((provider) => provider.enabled);
  const startIndex = hasConfiguredProviders
    ? getRoundRobinStartIndex(providers.length)
    : 0;
  const order = getAttemptOrder(providers.length, startIndex);
  const errors: string[] = [];
  let lastError: AiExtractionError | null = null;

  for (const providerIndex of order) {
    const provider = providers[providerIndex];

    if (provider.endpoint.trim() === "") {
      const missingEndpointError = new AiExtractionError("network", "missing endpoint");
      if (!hasConfiguredProviders) {
        throw missingEndpointError;
      }
      errors.push(`${provider.id}: network (missing endpoint)`);
      lastError = missingEndpointError;
      continue;
    }

    if (isProviderOnCooldown(provider.id)) {
      errors.push(`${provider.id}: network (provider on cooldown)`);
      continue;
    }

    const headers = buildHeaders(provider, opts.extraHeaders);
    const body = buildBody(provider, prompt, rawBase64);

    try {
      const res = await postJson(
        provider.endpoint,
        headers,
        body,
        provider.timeoutMs,
        opts.signal
      );

      if (!res.ok) {
        throw new AiExtractionError(
          "http_error",
          `HTTP ${res.status}: ${res.statusText ?? ""}`.trim()
        );
      }

      const text = await extractResponseText(provider, res);
      const parsed = parseAiExtractionJson(text);

      markProviderSuccess(provider.id);
      if (hasConfiguredProviders && providers.length > 1) {
        setRoundRobinStartIndex((providerIndex + 1) % providers.length);
      }
      return parsed;
    } catch (err) {
      const aiError = toAiError(err, provider.timeoutMs);
      errors.push(formatProviderError(provider, aiError));
      lastError = aiError;

      if (isTransientError(aiError) || hasConfiguredProviders) {
        markProviderFailure(provider);
      }
    }
  }

  if (!hasConfiguredProviders && lastError) {
    throw lastError;
  }

  if (hasConfiguredProviders && providers.length > 1) {
    setRoundRobinStartIndex((startIndex + 1) % providers.length);
  }

  throw new AiExtractionError(
    "network",
    `all AI providers failed: ${errors.join(" | ")}`
  );
}
