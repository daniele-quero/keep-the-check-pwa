export enum CurrencyCode {
  EUR = "EUR", USD = "USD", GBP = "GBP", JPY = "JPY", CNY = "CNY",
  CHF = "CHF", CAD = "CAD", AUD = "AUD", INR = "INR", BRL = "BRL",
  KRW = "KRW", MXN = "MXN", SEK = "SEK", NOK = "NOK", DKK = "DKK",
  PLN = "PLN", TRY = "TRY", RUB = "RUB", ZAR = "ZAR", AED = "AED",
}

export type PriceItemSource = "ai" | "manual" | "legacy";

export interface PriceItem {
  id: number;
  product: string;
  price: number;
  quantity: number;
  currency?: string | null;
  confidence?: number;
  source?: PriceItemSource;
}

let _nextId = 0;

export function generateId(): number {
  return ++_nextId;
}

export function createPriceItem(product: string, price: number): PriceItem {
  return { id: generateId(), product, price, quantity: 1, source: "manual" };
}

export interface AiExtractedItem {
  name: string | null;
  price: number;
  currency: string | null;
  confidence: number;
}

export function createItemFromAi(extracted: AiExtractedItem, quantity = 1): PriceItem {
  return {
    id: generateId(),
    product: extracted.name ?? "",
    price: extracted.price,
    quantity,
    currency: extracted.currency,
    confidence: extracted.confidence,
    source: "ai",
  };
}
