import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AI_PROVIDER_PRESETS,
  ConfigService,
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

const TEST_PROVIDERS = AI_PROVIDER_PRESETS.map((provider) => ({
  ...provider,
  enabled: provider.id === "huggingface",
  priority: provider.priority + 1,
}));

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
    expect(svc.current.aiProviders.length).toBeGreaterThanOrEqual(5);
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
      couponValue: 10,
      schemaVersion: 4,
    }));

    const svc2 = new ConfigService(storage);
    expect(svc2.current.currency).toBe(CurrencyCode.GBP);
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

const OPTIONS_TEST_VALUES: AppConfigData = {
  currency: CurrencyCode.USD,
  useCoupons: true,
  couponValue: 50,
  couponAlertThreshold: 0.1,
  aiEndpoint: "https://example.invalid/v1/chat/completions",
  aiModel: "gpt-4o",
  aiApiKey: "sk-test-key",
  aiTimeoutMs: 12345,
  aiUseProxy: false,
  aiProviders: TEST_PROVIDERS,
  requireManualConfirm: false,
  schemaVersion: 4,
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

      const persisted = JSON.parse(storage.getItem("appConfig")!) as Record<string, unknown>;
      expect(persisted[key]).toEqual(value);

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

describe("ConfigService – AI-image fields and schema migration", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it("empty storage yields defaults with schemaVersion 4", () => {
    const svc = new ConfigService(storage);
    expect(svc.current.aiEndpoint).toBe("");
    expect(svc.current.aiModel).toBe("gpt-4o-mini");
    expect(svc.current.aiApiKey).toBe("");
    expect(svc.current.aiTimeoutMs).toBe(30000);
    expect(svc.current.aiUseProxy).toBe(true);
    expect(svc.current.aiProviders.length).toBeGreaterThanOrEqual(5);
    expect(svc.current.requireManualConfirm).toBe(true);
    expect(svc.current.schemaVersion).toBe(4);
  });

  it("loading a legacy v2 blob strips legacy keys, fills defaults and stamps schemaVersion 4", () => {
    const legacy = {
      currency: "USD",
      aiProvider: "Groq",
      ocrProvider: "OcrSpace",
      ocrEngine: "3",
      ocrIsTable: true,
      useOcr: true,
      ocrApiKeys: { OcrSpace: "legacy-ocr-key" },
      aiApiKeys: { Gemini: "g", Groq: "q" },
      useCoupons: true,
      couponValue: 7,
      schemaVersion: 2,
    };
    storage.setItem("appConfig", JSON.stringify(legacy));

    const svc = new ConfigService(storage);

    expect(svc.current.currency).toBe(CurrencyCode.USD);
    expect(svc.current.useCoupons).toBe(true);
    expect(svc.current.couponValue).toBe(7);
    expect(svc.current.schemaVersion).toBe(4);

    const loaded = svc.current as unknown as Record<string, unknown>;
    expect(loaded.aiProvider).toBeUndefined();
    expect(loaded.ocrProvider).toBeUndefined();
    expect(loaded.ocrEngine).toBeUndefined();
    expect(loaded.ocrIsTable).toBeUndefined();
    expect(loaded.useOcr).toBeUndefined();
    expect(loaded.ocrApiKeys).toBeUndefined();
    expect(loaded.aiApiKeys).toBeUndefined();

    const persisted = JSON.parse(storage.getItem("appConfig")!) as Record<string, unknown>;
    expect(persisted.schemaVersion).toBe(4);
    expect(persisted.aiProvider).toBeUndefined();
    expect(persisted.ocrProvider).toBeUndefined();
    expect(persisted.ocrEngine).toBeUndefined();
    expect(persisted.ocrIsTable).toBeUndefined();
    expect(persisted.useOcr).toBeUndefined();
    expect(persisted.ocrApiKeys).toBeUndefined();
    expect(persisted.aiApiKeys).toBeUndefined();
  });

  it("migration persists exactly once on load (no extra writes)", () => {
    const legacy = { currency: "USD", aiApiKeys: { Gemini: "x" } };
    storage.setItem("appConfig", JSON.stringify(legacy));
    const setItemSpy = vi.spyOn(storage, "setItem");

    new ConfigService(storage);

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith("appConfig", expect.stringContaining("\"schemaVersion\":4"));
    const persistedArg = setItemSpy.mock.calls[0][1];
    expect(persistedArg).not.toContain("aiApiKeys");
  });

  it("loading an already-v4 config is a no-op (no re-persist on read)", () => {
    const v4 = {
      currency: "EUR",
      useCoupons: false,
      couponValue: 0,
      couponAlertThreshold: 0.2,
      aiEndpoint: "https://api.example/v1",
      aiModel: "gpt-4o",
      aiApiKey: "sk-abc",
      aiTimeoutMs: 15000,
      aiUseProxy: false,
      aiProviders: TEST_PROVIDERS,
      requireManualConfirm: false,
      schemaVersion: 4,
    } as AppConfigData;
    storage.setItem("appConfig", JSON.stringify(v4));
    const setItemSpy = vi.spyOn(storage, "setItem");

    const svc = new ConfigService(storage);

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(svc.current.aiEndpoint).toBe("https://api.example/v1");
    expect(svc.current.aiModel).toBe("gpt-4o");
    expect(svc.current.aiApiKey).toBe("sk-abc");
    expect(svc.current.aiTimeoutMs).toBe(15000);
    expect(svc.current.aiUseProxy).toBe(false);
    expect(svc.current.aiProviders[0].id).toBe("huggingface");
    expect(svc.current.requireManualConfirm).toBe(false);
    expect(svc.current.schemaVersion).toBe(4);
  });
});
