import { CurrencyCode, AiProvider, OcrProvider } from "./models";

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
  aiProvider: AiProvider;
  ocrProvider: OcrProvider;
  ocrEngine: string;
  ocrIsTable: boolean;
  useOcr: boolean;
  useCoupons: boolean;
  couponValue: number;
  couponAlertThreshold: number;
  ocrApiKeys: Record<string, string>;
  aiApiKeys: Record<string, string>;
}

const DEFAULTS: AppConfigData = {
  currency: CurrencyCode.EUR,
  aiProvider: AiProvider.Gemini,
  ocrProvider: OcrProvider.OcrSpace,
  ocrEngine: "1",
  ocrIsTable: false,
  useOcr: true,
  useCoupons: false,
  couponValue: 0,
  couponAlertThreshold: 0.2,
  ocrApiKeys: { OcrSpace: "" },
  aiApiKeys: { Gemini: "", Groq: "" },
};

const STORAGE_KEY = "appConfig";

export class ConfigService {
  private data: AppConfigData;
  private listeners: Array<() => void> = [];
  private storage?: Storage;

  constructor(storage?: Storage) {
    this.storage = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
    const saved = this.storage?.getItem(STORAGE_KEY);
    this.data = saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
  }

  get current(): Readonly<AppConfigData> {
    return this.data;
  }

  save(partial: Partial<AppConfigData>): void {
    Object.assign(this.data, partial);
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

  getAiApiKey(): string {
    return this.data.aiApiKeys[this.data.aiProvider] ?? "";
  }

  getOcrApiKey(): string {
    return this.data.ocrApiKeys[this.data.ocrProvider] ?? "";
  }
}

export const config = new ConfigService();
