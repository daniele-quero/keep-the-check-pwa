import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ConfigService,
  PROVIDERS_ENDPOINT,
  PROXY_ENDPOINT,
  AI_REQUEST_TIMEOUT_MS,
  type AppConfigData,
} from "../src/config";
import { CurrencyCode } from "../src/models";

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
    expect(svc.current.useCoupons).toBe(false);
    expect(svc.current.couponAlertThreshold).toBe(0.2);
    expect(svc.current.requireManualConfirm).toBe(true);
    expect(svc.current.schemaVersion).toBe(5);
  });

  it("saves and persists to storage", () => {
    svc.save({ currency: CurrencyCode.USD, useCoupons: true });

    expect(svc.current.currency).toBe(CurrencyCode.USD);
    expect(svc.current.useCoupons).toBe(true);

    const loaded = JSON.parse(storage.getItem("appConfig")!);
    expect(loaded.currency).toBe("USD");
    expect(loaded.useCoupons).toBe(true);
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

describe("config proxy constants", () => {
  it("exports the Netlify Functions endpoints and timeout", () => {
    expect(PROVIDERS_ENDPOINT).toBe("/.netlify/functions/ai-providers");
    expect(PROXY_ENDPOINT).toBe("/.netlify/functions/ai-proxy");
    expect(AI_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
  });
});

const OPTIONS_TEST_VALUES: AppConfigData = {
  currency: CurrencyCode.USD,
  useCoupons: true,
  couponValue: 50,
  couponAlertThreshold: 0.1,
  requireManualConfirm: false,
  schemaVersion: 5,
};

describe("ConfigService – field round-trip", () => {
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

      const persisted = JSON.parse(storage.getItem("appConfig")!) as Record<string, unknown>;
      expect(persisted[key]).toEqual(value);

      const svc2 = new ConfigService(storage);
      expect(svc2.current[key]).toEqual(value);
    }
  );

  it("does not expose any AI key/endpoint fields", () => {
    const svc = new ConfigService(storage);
    const current = svc.current as unknown as Record<string, unknown>;
    expect(current.aiApiKey).toBeUndefined();
    expect(current.aiEndpoint).toBeUndefined();
    expect(current.aiModel).toBeUndefined();
    expect(current.aiProviders).toBeUndefined();
    expect(current.aiUseProxy).toBeUndefined();
    expect(current.aiTimeoutMs).toBeUndefined();
  });
});

describe("ConfigService – schema migration to v5", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it("empty storage yields defaults with schemaVersion 5 and no AI key fields", () => {
    const svc = new ConfigService(storage);
    expect(svc.current.requireManualConfirm).toBe(true);
    expect(svc.current.schemaVersion).toBe(5);
    const current = svc.current as unknown as Record<string, unknown>;
    expect(current.aiApiKey).toBeUndefined();
    expect(current.aiProviders).toBeUndefined();
  });

  it("migrates a v4 config, stripping AI endpoint/key/provider fields, keeping currency/coupons", () => {
    const v4 = {
      currency: "USD",
      useCoupons: true,
      couponValue: 7,
      couponAlertThreshold: 0.1,
      aiEndpoint: "https://api.example/v1",
      aiModel: "gpt-4o",
      aiApiKey: "sk-should-be-stripped",
      aiTimeoutMs: 15000,
      aiUseProxy: false,
      aiProviders: [{ id: "huggingface", apiKey: "leaked-key" }],
      requireManualConfirm: false,
      schemaVersion: 4,
    };
    storage.setItem("appConfig", JSON.stringify(v4));

    const svc = new ConfigService(storage);

    expect(svc.current.currency).toBe(CurrencyCode.USD);
    expect(svc.current.useCoupons).toBe(true);
    expect(svc.current.couponValue).toBe(7);
    expect(svc.current.requireManualConfirm).toBe(false);
    expect(svc.current.schemaVersion).toBe(5);

    const current = svc.current as unknown as Record<string, unknown>;
    expect(current.aiEndpoint).toBeUndefined();
    expect(current.aiApiKey).toBeUndefined();
    expect(current.aiProviders).toBeUndefined();

    const persisted = JSON.parse(storage.getItem("appConfig")!) as Record<string, unknown>;
    expect(persisted.schemaVersion).toBe(5);
    expect(persisted.aiApiKey).toBeUndefined();
    expect(persisted.aiProviders).toBeUndefined();
    expect(JSON.stringify(persisted)).not.toContain("leaked-key");
    expect(JSON.stringify(persisted)).not.toContain("sk-should-be-stripped");
  });

  it("strips legacy v2 keys and stamps schemaVersion 5", () => {
    const legacy = {
      currency: "USD",
      aiProvider: "Groq",
      ocrProvider: "OcrSpace",
      ocrApiKeys: { OcrSpace: "legacy-ocr-key" },
      aiApiKeys: { Gemini: "g", Groq: "q" },
      useCoupons: true,
      couponValue: 7,
      schemaVersion: 2,
    };
    storage.setItem("appConfig", JSON.stringify(legacy));

    const svc = new ConfigService(storage);
    const current = svc.current as unknown as Record<string, unknown>;
    expect(current.aiProvider).toBeUndefined();
    expect(current.ocrProvider).toBeUndefined();
    expect(current.aiApiKeys).toBeUndefined();
    expect(svc.current.schemaVersion).toBe(5);

    const persisted = JSON.parse(storage.getItem("appConfig")!) as Record<string, unknown>;
    expect(persisted.aiApiKeys).toBeUndefined();
    expect(persisted.ocrApiKeys).toBeUndefined();
  });

  it("migration persists exactly once on load (no extra writes)", () => {
    const legacy = { currency: "USD", aiApiKey: "sk-x", aiProviders: [], schemaVersion: 4 };
    storage.setItem("appConfig", JSON.stringify(legacy));
    const setItemSpy = vi.spyOn(storage, "setItem");

    new ConfigService(storage);

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    const persistedArg = setItemSpy.mock.calls[0][1];
    expect(persistedArg).toContain("\"schemaVersion\":5");
    expect(persistedArg).not.toContain("aiApiKey");
    expect(persistedArg).not.toContain("aiProviders");
  });

  it("loading an already-v5 config is a no-op (no re-persist on read)", () => {
    const v5 = {
      currency: "EUR",
      useCoupons: false,
      couponValue: 0,
      couponAlertThreshold: 0.2,
      requireManualConfirm: false,
      schemaVersion: 5,
    } as AppConfigData;
    storage.setItem("appConfig", JSON.stringify(v5));
    const setItemSpy = vi.spyOn(storage, "setItem");

    const svc = new ConfigService(storage);

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(svc.current.requireManualConfirm).toBe(false);
    expect(svc.current.schemaVersion).toBe(5);
  });
});
