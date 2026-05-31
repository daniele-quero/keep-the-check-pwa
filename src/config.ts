import { CurrencyCode } from "./models";

export type ProviderId =
  | "huggingface"
  | "cloudflare"
  | "fireworks"
  | "mistral"
  | "replicate"
  | string;

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  endpointTemplate: string;
  model: string;
  apiKey: string;
  useProxy: boolean;
  enabled: boolean;
  priority: number;
  timeoutMs: number;
  extraHeaders?: Record<string, string>;
  supportsImages: boolean;
  failureThreshold: number;
  cooldownMs: number;
}

const DEFAULT_PROVIDER_TIMEOUT_MS = 30000;
const DEFAULT_PROVIDER_FAILURE_THRESHOLD = 3;
const DEFAULT_PROVIDER_COOLDOWN_MS = 120000;

export const AI_PROVIDER_PRESETS: ProviderConfig[] = [
  {
    id: "huggingface",
    name: "Hugging Face",
    endpointTemplate: "https://router.huggingface.co/v1/chat/completions",
    model: "Qwen/Qwen2.5-VL-7B-Instruct",
    apiKey: "",
    useProxy: true,
    enabled: false,
    priority: 1,
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    supportsImages: true,
    failureThreshold: DEFAULT_PROVIDER_FAILURE_THRESHOLD,
    cooldownMs: DEFAULT_PROVIDER_COOLDOWN_MS,
  },
  {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    endpointTemplate:
      "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1/chat/completions",
    model: "@cf/meta/llama-3.2-11b-vision-instruct",
    apiKey: "",
    useProxy: true,
    enabled: false,
    priority: 2,
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    supportsImages: true,
    failureThreshold: DEFAULT_PROVIDER_FAILURE_THRESHOLD,
    cooldownMs: DEFAULT_PROVIDER_COOLDOWN_MS,
  },
  {
    id: "fireworks",
    name: "Fireworks",
    endpointTemplate: "https://api.fireworks.ai/inference/v1/chat/completions",
    model: "accounts/fireworks/models/llama-v3p2-90b-vision-instruct",
    apiKey: "",
    useProxy: true,
    enabled: false,
    priority: 3,
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    supportsImages: true,
    failureThreshold: DEFAULT_PROVIDER_FAILURE_THRESHOLD,
    cooldownMs: DEFAULT_PROVIDER_COOLDOWN_MS,
  },
  {
    id: "mistral",
    name: "Mistral",
    endpointTemplate: "https://api.mistral.ai/v1/chat/completions",
    model: "pixtral-12b-2409",
    apiKey: "",
    useProxy: true,
    enabled: false,
    priority: 4,
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    supportsImages: true,
    failureThreshold: DEFAULT_PROVIDER_FAILURE_THRESHOLD,
    cooldownMs: DEFAULT_PROVIDER_COOLDOWN_MS,
  },
  {
    id: "replicate",
    name: "Replicate",
    endpointTemplate: "https://api.replicate.com/v1/predictions",
    model: "meta/meta-llama-3.2-11b-vision-instruct",
    apiKey: "",
    useProxy: true,
    enabled: false,
    priority: 5,
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    supportsImages: true,
    failureThreshold: DEFAULT_PROVIDER_FAILURE_THRESHOLD,
    cooldownMs: DEFAULT_PROVIDER_COOLDOWN_MS,
  },
];

function cloneProviders(providers: ProviderConfig[]): ProviderConfig[] {
  return providers.map((provider) => ({
    ...provider,
    extraHeaders: provider.extraHeaders ? { ...provider.extraHeaders } : undefined,
  }));
}

function normalizeExtraHeaders(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeProvider(input: unknown): ProviderConfig | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return null;

  const preset = AI_PROVIDER_PRESETS.find((p) => p.id === id);
  const base: ProviderConfig = preset
    ? { ...preset }
    : {
      id,
      name: id,
      endpointTemplate: "",
      model: "",
      apiKey: "",
      useProxy: true,
      enabled: false,
      priority: Number.MAX_SAFE_INTEGER,
      timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
      supportsImages: true,
      failureThreshold: DEFAULT_PROVIDER_FAILURE_THRESHOLD,
      cooldownMs: DEFAULT_PROVIDER_COOLDOWN_MS,
    };

  const priority =
    typeof raw.priority === "number" && Number.isFinite(raw.priority)
      ? Math.max(1, Math.floor(raw.priority))
      : base.priority;

  const timeoutMs =
    typeof raw.timeoutMs === "number" && Number.isFinite(raw.timeoutMs)
      ? Math.max(1000, Math.floor(raw.timeoutMs))
      : base.timeoutMs;

  const failureThreshold =
    typeof raw.failureThreshold === "number" && Number.isFinite(raw.failureThreshold)
      ? Math.max(1, Math.floor(raw.failureThreshold))
      : base.failureThreshold;

  const cooldownMs =
    typeof raw.cooldownMs === "number" && Number.isFinite(raw.cooldownMs)
      ? Math.max(1000, Math.floor(raw.cooldownMs))
      : base.cooldownMs;

  return {
    ...base,
    name: typeof raw.name === "string" ? raw.name : base.name,
    endpointTemplate:
      typeof raw.endpointTemplate === "string"
        ? raw.endpointTemplate
        : base.endpointTemplate,
    model: typeof raw.model === "string" ? raw.model : base.model,
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : base.apiKey,
    useProxy: typeof raw.useProxy === "boolean" ? raw.useProxy : base.useProxy,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : base.enabled,
    priority,
    timeoutMs,
    extraHeaders: normalizeExtraHeaders(raw.extraHeaders) ?? base.extraHeaders,
    supportsImages:
      typeof raw.supportsImages === "boolean"
        ? raw.supportsImages
        : base.supportsImages,
    failureThreshold,
    cooldownMs,
  };
}

function mergeWithProviderPresets(input: unknown): ProviderConfig[] {
  const merged = cloneProviders(AI_PROVIDER_PRESETS);
  if (Array.isArray(input)) {
    for (const entry of input) {
      const provider = sanitizeProvider(entry);
      if (!provider) continue;
      const idx = merged.findIndex((p) => p.id === provider.id);
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...provider };
      } else {
        merged.push(provider);
      }
    }
  }
  return merged.sort((a, b) => a.priority - b.priority);
}

export interface CurrencyEntry {
  code: CurrencyCode;
  symbol: string;
}

export const CURRENCIES: CurrencyEntry[] = [
  { code: CurrencyCode.EUR, symbol: "\u20AC" },
  { code: CurrencyCode.USD, symbol: "$" },
  { code: CurrencyCode.GBP, symbol: "\u00A3" },
  { code: CurrencyCode.JPY, symbol: "\u00A5" },
  { code: CurrencyCode.CNY, symbol: "\u00A5" },
  { code: CurrencyCode.CHF, symbol: "CHF" },
  { code: CurrencyCode.CAD, symbol: "C$" },
  { code: CurrencyCode.AUD, symbol: "A$" },
  { code: CurrencyCode.INR, symbol: "\u20B9" },
  { code: CurrencyCode.BRL, symbol: "R$" },
  { code: CurrencyCode.KRW, symbol: "\u20A9" },
  { code: CurrencyCode.MXN, symbol: "MX$" },
  { code: CurrencyCode.SEK, symbol: "kr" },
  { code: CurrencyCode.NOK, symbol: "kr" },
  { code: CurrencyCode.DKK, symbol: "kr" },
  { code: CurrencyCode.PLN, symbol: "z\u0142" },
  { code: CurrencyCode.TRY, symbol: "\u20BA" },
  { code: CurrencyCode.RUB, symbol: "\u20BD" },
  { code: CurrencyCode.ZAR, symbol: "R" },
  { code: CurrencyCode.AED, symbol: "\u062F.\u0625" },
];

export interface AppConfigData {
  currency: CurrencyCode;
  useCoupons: boolean;
  couponValue: number;
  couponAlertThreshold: number;
  aiEndpoint: string;
  aiModel: string;
  aiApiKey: string;
  aiTimeoutMs: number;
  aiUseProxy: boolean;
  aiProviders: ProviderConfig[];
  requireManualConfirm: boolean;
  schemaVersion: number;
}

const CURRENT_SCHEMA_VERSION = 4;

const LEGACY_KEYS_TO_STRIP = [
  "ocrProvider",
  "ocrEngine",
  "ocrIsTable",
  "useOcr",
  "ocrApiKeys",
  "aiProvider",
  "aiApiKeys",
] as const;

const DEFAULTS: AppConfigData = {
  currency: CurrencyCode.EUR,
  useCoupons: false,
  couponValue: 0,
  couponAlertThreshold: 0.2,
  aiEndpoint: "",
  aiModel: "gpt-4o-mini",
  aiApiKey: "",
  aiTimeoutMs: 30000,
  aiUseProxy: true,
  aiProviders: cloneProviders(AI_PROVIDER_PRESETS),
  requireManualConfirm: true,
  schemaVersion: CURRENT_SCHEMA_VERSION,
};

const STORAGE_KEY = "appConfig";

export class ConfigService {
  private data: AppConfigData;
  private listeners: Array<() => void> = [];
  private storage?: Storage;

  constructor(storage?: Storage) {
    this.storage = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
    const saved = this.storage?.getItem(STORAGE_KEY);
    if (!saved) {
      this.data = { ...DEFAULTS };
      return;
    }
    const raw = JSON.parse(saved) as Record<string, unknown>;
    const rawVersion = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
    const hasLegacyKey = LEGACY_KEYS_TO_STRIP.some((k) =>
      Object.prototype.hasOwnProperty.call(raw, k)
    );
    const needsMigration = rawVersion < CURRENT_SCHEMA_VERSION || hasLegacyKey;

    const clean: Record<string, unknown> = { ...raw };
    for (const k of LEGACY_KEYS_TO_STRIP) {
      delete clean[k];
    }

    const aiProviders = mergeWithProviderPresets(clean.aiProviders);

    this.data = {
      ...DEFAULTS,
      ...(clean as Partial<AppConfigData>),
      aiProviders,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };

    if (needsMigration) {
      try {
        this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch { /* storage full or unavailable */ }
    }
  }

  get current(): Readonly<AppConfigData> {
    return this.data;
  }

  save(partial: Partial<AppConfigData>): void {
    const normalized: Partial<AppConfigData> = { ...partial };
    if (Object.prototype.hasOwnProperty.call(normalized, "aiProviders")) {
      normalized.aiProviders = mergeWithProviderPresets(normalized.aiProviders);
    }

    Object.assign(this.data, normalized);
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch { /* storage full or unavailable */ }
    this.listeners.forEach((fn) => fn());
  }

  onChanged(fn: () => void): void {
    this.listeners.push(fn);
  }

  removeListener(fn: () => void): void {
    this.listeners = this.listeners.filter((l) => l !== fn);
  }

  getCurrencySymbol(): string {
    return CURRENCIES.find((c) => c.code === this.data.currency)?.symbol ?? "?";
  }
}

export const config = new ConfigService();
