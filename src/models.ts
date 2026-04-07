export enum OcrProvider {
  OcrSpace = "OcrSpace",
}

export enum AiProvider {
  Gemini = "Gemini",
  Groq = "Groq",
}

export enum CurrencyCode {
  EUR = "EUR", USD = "USD", GBP = "GBP", JPY = "JPY", CNY = "CNY",
  CHF = "CHF", CAD = "CAD", AUD = "AUD", INR = "INR", BRL = "BRL",
  KRW = "KRW", MXN = "MXN", SEK = "SEK", NOK = "NOK", DKK = "DKK",
  PLN = "PLN", TRY = "TRY", RUB = "RUB", ZAR = "ZAR", AED = "AED",
}

export interface PriceItem {
  id: number;
  product: string;
  price: number;
}

export interface PriceResult {
  items: PriceItem[];
}

let _nextId = 0;

export function generateId(): number {
  return ++_nextId;
}

export function createPriceItem(product: string, price: number): PriceItem {
  return { id: generateId(), product, price };
}
