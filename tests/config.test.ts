import { describe, it, expect, beforeEach } from "vitest";
import { ConfigService, type AppConfigData } from "../src/config";
import { CurrencyCode, AiProvider, OcrProvider } from "../src/models";

function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

describe("ConfigService", () => {
  let storage: Storage;
  let svc: ConfigService;

  beforeEach(() => {
    storage = createMockStorage();
    svc = new ConfigService(storage);
  });

  it("starts with defaults", () => {
    expect(svc.current.currency).toBe(CurrencyCode.EUR);
    expect(svc.current.aiProvider).toBe(AiProvider.Gemini);
    expect(svc.current.useCoupons).toBe(false);
    expect(svc.current.couponAlertThreshold).toBe(0.2);
  });

  it("saves and persists to storage", () => {
    svc.save({ currency: CurrencyCode.USD, useCoupons: true });

    expect(svc.current.currency).toBe(CurrencyCode.USD);
    expect(svc.current.useCoupons).toBe(true);

    const loaded = JSON.parse(storage.getItem("appConfig")!);
    expect(loaded.currency).toBe("USD");
    expect(loaded.useCoupons).toBe(true);
  });

  it("loads saved values on init", () => {
    storage.setItem("appConfig", JSON.stringify({
      currency: "GBP",
      aiProvider: "Groq",
      couponValue: 10,
    }));

    const svc2 = new ConfigService(storage);
    expect(svc2.current.currency).toBe(CurrencyCode.GBP);
    expect(svc2.current.aiProvider).toBe(AiProvider.Groq);
    expect(svc2.current.couponValue).toBe(10);
  });

  it("notifies listeners on save", () => {
    let called = 0;
    svc.onChanged(() => called++);
    svc.save({ couponValue: 5 });
    expect(called).toBe(1);
  });

  it("removeListener stops notifications", () => {
    let called = 0;
    const fn = () => called++;
    svc.onChanged(fn);
    svc.save({ couponValue: 1 });
    expect(called).toBe(1);

    svc.removeListener(fn);
    svc.save({ couponValue: 2 });
    expect(called).toBe(1);
  });

  it("getCurrencySymbol returns correct symbol", () => {
    expect(svc.getCurrencySymbol()).toBe("\u20AC");
    svc.save({ currency: CurrencyCode.USD });
    expect(svc.getCurrencySymbol()).toBe("$");
    svc.save({ currency: CurrencyCode.GBP });
    expect(svc.getCurrencySymbol()).toBe("\u00A3");
  });

  it("getCurrencySymbol returns ? for unknown code", () => {
    svc.save({ currency: "FAKE" as CurrencyCode });
    expect(svc.getCurrencySymbol()).toBe("?");
  });
});

// ---------------------------------------------------------------------------
// Dynamic round-trip: every AppConfigData field must survive save → reload
// ---------------------------------------------------------------------------
// Non-default test value for every field of AppConfigData.
// If a field is ever added to AppConfigData, the "covers every field" test
// below will fail with a clear diff, forcing the map to be updated.
const OPTIONS_TEST_VALUES: AppConfigData = {
  currency: CurrencyCode.USD,
  aiProvider: AiProvider.Groq,
  ocrProvider: OcrProvider.OcrSpace,
  ocrEngine: "3",
  ocrIsTable: true,
  useOcr: false,
  useCoupons: true,
  couponValue: 50,
  couponAlertThreshold: 0.1,
  ocrApiKeys: { OcrSpace: "ocr-test-key" },
  aiApiKeys: { Gemini: "gemini-test-key", Groq: "groq-test-key" },
};

describe("ConfigService – options modal dynamic round-trip", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it("OPTIONS_TEST_VALUES covers every AppConfigData field", () => {
    const svc = new ConfigService(storage);
    const configKeys = Object.keys(svc.current).sort();
    const testKeys = Object.keys(OPTIONS_TEST_VALUES).sort();
    expect(testKeys).toEqual(configKeys);
  });

  it.each(Object.entries(OPTIONS_TEST_VALUES) as [keyof AppConfigData, AppConfigData[keyof AppConfigData]][])(
    "field '%s' is persisted to localStorage and reloaded correctly",
    (key, value) => {
      const svc = new ConfigService(storage);
      svc.save({ [key]: value } as Partial<AppConfigData>);

      // Verify the raw JSON in storage contains the expected value
      const persisted = JSON.parse(storage.getItem("appConfig")!) as Record<string, unknown>;
      expect(persisted[key]).toEqual(value);

      // Verify a fresh ConfigService instance reads the persisted value
      const svc2 = new ConfigService(storage);
      expect(svc2.current[key]).toEqual(value);
    }
  );

  it("all fields together survive a full save/reload cycle", () => {
    const svc = new ConfigService(storage);
    svc.save(OPTIONS_TEST_VALUES);

    const persisted = JSON.parse(storage.getItem("appConfig")!) as Record<string, unknown>;
    for (const [key, value] of Object.entries(OPTIONS_TEST_VALUES)) {
      expect(persisted[key]).toEqual(value);
    }

    const svc2 = new ConfigService(storage);
    for (const [key, value] of Object.entries(OPTIONS_TEST_VALUES) as [keyof AppConfigData, AppConfigData[keyof AppConfigData]][]) {
      expect(svc2.current[key]).toEqual(value);
    }
  });
});
