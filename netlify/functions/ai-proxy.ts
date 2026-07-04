// Netlify Function: POST /.netlify/functions/ai-proxy
// Server-side AI vision proxy. Reads provider keys from process.env (never from
// the client, never returned to the client) and performs a cyclic fallback
// across vision-capable providers that have a configured key.
//
// Request body (OpenAI-style, as produced by src/api.ts sendImageToAI):
//   { messages: [...], response_format?: {...} }
// or the compact form:
//   { providerId?, imageBase64, prompt, mimeType? }
// Provider selection: header "X-Provider-Id" (preferred) or body.providerId.
// Optional attemptOrder: body.attemptOrder (string[]).

import {
  getVisionProviders,
  type ProviderCatalogEntry,
} from "../../src/providerCatalog";

declare const process: { env: Record<string, string | undefined> };

const PROVIDER_TIMEOUT_MS = 30000;
const DATA_URL_PREFIX_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;

interface ProxyAttempt {
  providerId: string;
  status: number | null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hasKey(entry: ProviderCatalogEntry): boolean {
  return Boolean(process.env[entry.envKey]?.trim());
}

function buildOrder(
  selectedId: string | null,
  attemptOrder: string[] | null
): ProviderCatalogEntry[] {
  const eligible = getVisionProviders().filter(hasKey);
  const byId = new Map(eligible.map((e) => [e.id, e]));
  const order: ProviderCatalogEntry[] = [];
  const pushed = new Set<string>();

  const add = (id: string): void => {
    if (pushed.has(id)) return;
    const entry = byId.get(id);
    if (entry) {
      order.push(entry);
      pushed.add(id);
    }
  };

  if (selectedId) add(selectedId);
  if (attemptOrder) for (const id of attemptOrder) add(id);
  for (const entry of eligible) add(entry.id);

  return order;
}

function buildUpstreamBody(
  payload: Record<string, unknown>,
  entry: ProviderCatalogEntry
): Record<string, unknown> {
  let base: Record<string, unknown>;

  if (Array.isArray(payload.messages) && payload.messages.length > 0) {
    base = { ...payload };
  } else {
    const rawBase64 = String(payload.imageBase64 ?? "").replace(
      DATA_URL_PREFIX_RE,
      ""
    );
    const mime =
      typeof payload.mimeType === "string" ? payload.mimeType : "image/jpeg";
    base = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: String(payload.prompt ?? "") },
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${rawBase64}` },
            },
          ],
        },
      ],
    };
  }

  base.model = entry.model;
  base.temperature = entry.temperature;
  base.max_tokens = entry.maxTokens;
  if (entry.jsonMode) {
    base.response_format = { type: "json_object" };
  } else {
    delete base.response_format;
  }

  // Strip client control fields so they never reach the upstream provider.
  delete base.providerId;
  delete base.attemptOrder;
  delete base.imageBase64;
  delete base.prompt;
  delete base.mimeType;

  return base;
}

function isCyclableStatus(status: number): boolean {
  return status === 429 || status === 401 || status === 403 || status >= 500;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (!payload || typeof payload !== "object") {
    return json(400, { error: "invalid_body" });
  }

  const hasMessages =
    Array.isArray(payload.messages) && payload.messages.length > 0;
  const hasImageField =
    typeof payload.imageBase64 === "string" &&
    payload.imageBase64.trim().length > 0;
  if (!hasMessages && !hasImageField) {
    return json(400, { error: "missing_image" });
  }

  const selectedId =
    req.headers.get("x-provider-id") ||
    (typeof payload.providerId === "string" ? payload.providerId : null);
  const attemptOrder = Array.isArray(payload.attemptOrder)
    ? payload.attemptOrder.filter((x): x is string => typeof x === "string")
    : null;

  const order = buildOrder(selectedId, attemptOrder);
  if (order.length === 0) {
    return json(502, { error: "no_providers_with_key", attempts: [] });
  }

  const attempts: ProxyAttempt[] = [];

  for (const entry of order) {
    const key = process.env[entry.envKey] as string;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(entry.extraHeaders ?? {}),
    };
    const body = buildUpstreamBody(payload, entry);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const res = await fetch(entry.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const text = await res.text();
        return new Response(text, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      attempts.push({ providerId: entry.id, status: res.status });
      if (isCyclableStatus(res.status)) continue;
      // Other 4xx: still advance to the next provider.
      continue;
    } catch {
      clearTimeout(timeout);
      attempts.push({ providerId: entry.id, status: null });
      continue;
    }
  }

  return json(502, { error: "all_providers_failed", attempts });
}
