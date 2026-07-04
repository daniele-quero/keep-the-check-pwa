// Shared, secret-free AI provider catalog.
// Contains only hardcoded, non-user-editable endpoints, models, tuning params
// and the NAME of the server-side env var that holds each provider key.
// It never contains a key value. Used by both the client and the Netlify
// Functions (server-side proxy).

export interface ProviderCatalogEntry {
  /** Stable id used by client selection and X-Provider-Id header. */
  id: string;
  /** Human readable name for the dropdown. */
  name: string;
  /** Hardcoded OpenAI-compatible chat/completions endpoint. Not user editable. */
  endpoint: string;
  /** Hardcoded model id tuned for deterministic price extraction. */
  model: string;
  /** Name of the server-side env var holding the API key (value never here). */
  envKey: string;
  /** True only for vision-capable models usable for image analysis. */
  supportsVision: boolean;
  /** Whether the provider supports OpenAI response_format json_object. */
  jsonMode: boolean;
  /** Hardcoded low temperature for deterministic extraction. */
  temperature: number;
  /** Hardcoded max output tokens. */
  maxTokens: number;
  /** Optional hardcoded extra request headers (e.g. OpenRouter attribution). */
  extraHeaders?: Record<string, string>;
}

const DEFAULT_TEMPERATURE = 0;
const DEFAULT_MAX_TOKENS = 1024;

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "google-gemini",
    name: "Google Gemini",
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.0-flash",
    envKey: "AI_KEY_GOOGLE_GEMINI",
    supportsVision: true,
    jsonMode: true,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  {
    id: "groq",
    name: "Groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    envKey: "AI_KEY_GROQ",
    supportsVision: true,
    jsonMode: true,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  {
    id: "mistral",
    name: "Mistral",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    model: "pixtral-12b-2409",
    envKey: "AI_KEY_MISTRAL",
    supportsVision: true,
    jsonMode: true,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  {
    id: "openrouter",
    name: "OpenRouter (free)",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.2-11b-vision-instruct:free",
    envKey: "AI_KEY_OPENROUTER",
    supportsVision: true,
    jsonMode: true,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    extraHeaders: {
      "HTTP-Referer": "https://keep-the-check.netlify.app",
      "X-Title": "Keep The Check",
    },
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    endpoint: "https://router.huggingface.co/v1/chat/completions",
    model: "Qwen/Qwen2.5-VL-7B-Instruct",
    envKey: "AI_KEY_HUGGINGFACE",
    supportsVision: true,
    jsonMode: false,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  {
    id: "xai-grok",
    name: "xAI Grok",
    endpoint: "https://api.x.ai/v1/chat/completions",
    model: "grok-2-vision-1212",
    envKey: "AI_KEY_XAI_GROK",
    supportsVision: true,
    jsonMode: true,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  {
    id: "cerebras",
    name: "Cerebras",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    model: "llama-3.3-70b",
    envKey: "AI_KEY_CEREBRAS",
    supportsVision: false,
    jsonMode: true,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
];

export function getCatalogEntry(id: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((entry) => entry.id === id);
}

export function getVisionProviders(): ProviderCatalogEntry[] {
  return PROVIDER_CATALOG.filter((entry) => entry.supportsVision);
}
