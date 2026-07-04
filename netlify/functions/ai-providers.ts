// Netlify Function: GET /.netlify/functions/ai-providers
// Returns the provider catalog with a server-side hasKey boolean per provider.
// It NEVER returns any key value — only booleans and hardcoded catalog metadata.

import { PROVIDER_CATALOG } from "../../src/providerCatalog";

declare const process: { env: Record<string, string | undefined> };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return json(405, { error: "method_not_allowed" });
  }

  const providers = PROVIDER_CATALOG.map((entry) => ({
    id: entry.id,
    name: entry.name,
    model: entry.model,
    supportsVision: entry.supportsVision,
    hasKey: Boolean(process.env[entry.envKey]?.trim()),
  }));

  return json(200, { providers });
}
