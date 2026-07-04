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

// Client-side endpoints for the server-side AI proxy (Netlify Functions).
export const PROVIDERS_ENDPOINT = "/.netlify/functions/ai-providers";
export const PROXY_ENDPOINT = "/.netlify/functions/ai-proxy";
export const AI_REQUEST_TIMEOUT_MS = 30000;

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
  requireManualConfirm: boolean;
  schemaVersion: number;
}

const CURRENT_SCHEMA_VERSION = 5;

const LEGACY_KEYS_TO_STRIP = [
  "ocrProvider",
  "ocrEngine",
  "ocrIsTable",
  "useOcr",
  "ocrApiKeys",
  "aiProvider",
  "aiApiKeys",
  "aiEndpoint",
  "aiModel",
  "aiApiKey",
  "aiTimeoutMs",
  "aiUseProxy",
  "aiProviders",
] as const;

const DEFAULTS: AppConfigData = {
  currency: CurrencyCode.EUR,
  useCoupons: false,
  couponValue: 0,
  couponAlertThreshold: 0.2,
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

    this.data = {
      ...DEFAULTS,
      ...(clean as Partial<AppConfigData>),
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
