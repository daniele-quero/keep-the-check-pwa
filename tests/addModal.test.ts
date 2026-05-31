import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAddModal } from "../src/modals/addModal";
import {
  AddModalController,
  type AddModalControllerConfig,
} from "../src/modals/addModalController";
import { IMAGE_EXTRACTION_PROMPT, type AiExtractionResult } from "../src/aiPrompt";
import type { PriceItem } from "../src/models";

function makeResult(
  overrides: Partial<AiExtractionResult> = {}
): AiExtractionResult {
  return {
    version: "1.0",
    products: [
      {
        id: "p1",
        name: "Latte",
        name_confidence: 0.92,
        name_raw: "LATTE",
        name_candidates: [{ text: "Latte", confidence: 0.92 }],
        prices: [
          {
            raw_text: "1,99",
            normalized: 1.99,
            currency: "EUR",
            confidence: 0.88,
            type: "unit_price",
            bounding_box: { x: 0, y: 0, width: 10, height: 10 },
          },
          {
            raw_text: "2,49",
            normalized: 2.49,
            currency: "EUR",
            confidence: 0.7,
            type: "old_price",
            bounding_box: { x: 0, y: 0, width: 10, height: 10 },
          },
        ],
      },
    ],
    image_text: "LATTE 1,99",
    metadata: { processing_ms: 10, model: "test" },
    warnings: [],
    uncertain: false,
    ...overrides,
  };
}

function defaultCfg(overrides: Partial<AddModalControllerConfig> = {}): AddModalControllerConfig {
  return {
    aiEndpoint: "https://example.test/ai",
    aiApiKey: "k",
    aiModel: "m",
    aiTimeoutMs: 30000,
    aiUseProxy: false,
    requireManualConfirm: true,
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("createAddModal", () => {
  it("injects the add modal HTML into the document", () => {
    createAddModal();
    expect(document.getElementById("add-panel")).not.toBeNull();
    expect(document.getElementById("add-overlay")).not.toBeNull();
  });

  it("does not inject duplicate HTML on second call", () => {
    createAddModal();
    createAddModal();
    expect(document.querySelectorAll("#add-panel").length).toBe(1);
  });

  it("contains AI status, results region, and manual fields", () => {
    createAddModal();
    expect(document.getElementById("add-ai-status")).not.toBeNull();
    expect(document.getElementById("add-ai-results")).not.toBeNull();
    expect(document.getElementById("add-ai-rows")).not.toBeNull();
    expect(document.getElementById("btn-ai-confirm")).not.toBeNull();
    expect(document.getElementById("btn-ai-manual-fallback")).not.toBeNull();
    expect(document.getElementById("add-product")).not.toBeNull();
    expect(document.getElementById("add-price")).not.toBeNull();
    expect(document.getElementById("add-qty-display")).not.toBeNull();
    expect(document.getElementById("add-ok")).not.toBeNull();
    expect(document.getElementById("add-cancel")).not.toBeNull();
  });

  it("AI status and results are hidden by default", () => {
    createAddModal();
    const status = document.getElementById("add-ai-status") as HTMLElement;
    const results = document.getElementById("add-ai-results") as HTMLElement;
    expect(status.hidden).toBe(true);
    expect(results.hidden).toBe(true);
  });

  it("status text says 'Analisi IA in corso…'", () => {
    createAddModal();
    const txt = document.getElementById("add-ai-status-text") as HTMLElement;
    expect(txt.textContent).toContain("Analisi IA in corso");
  });
});

describe("AddModalController.analyzeImage", () => {
  it("shows spinner, calls sendImageToAI once with the prompt, then renders results", async () => {
    createAddModal();
    const result = makeResult();
    let observedDuringCall = false;
    const sendImageToAI = vi.fn(async () => {
      const status = document.getElementById("add-ai-status") as HTMLElement;
      observedDuringCall = !status.hidden;
      return result;
    });
    const addItem = vi.fn();
    const ctrl = new AddModalController({
      sendImageToAI,
      getConfig: () => defaultCfg(),
      addItem,
      root: document,
      prompt: IMAGE_EXTRACTION_PROMPT,
    });

    await ctrl.analyzeImage("BASE64DATA");

    expect(sendImageToAI).toHaveBeenCalledTimes(1);
    const firstCall = sendImageToAI.mock.calls[0] as unknown as [string, string, unknown];
    expect(firstCall[0]).toBe("BASE64DATA");
    expect(firstCall[1]).toBe(IMAGE_EXTRACTION_PROMPT);
    expect(observedDuringCall).toBe(true);

    const status = document.getElementById("add-ai-status") as HTMLElement;
    const results = document.getElementById("add-ai-results") as HTMLElement;
    expect(status.hidden).toBe(true);
    expect(results.hidden).toBe(false);

    const rows = document.querySelectorAll("#add-ai-rows .add-ai-row");
    expect(rows.length).toBe(2);
    const productInput = document.getElementById("add-ai-product") as HTMLInputElement;
    expect(productInput.value).toBe("Latte");
    expect(addItem).not.toHaveBeenCalled();
  });

  it("shows fallback message and hides spinner on AI error", async () => {
    createAddModal();
    const sendImageToAI = vi.fn(async () => {
      throw new Error("boom");
    });
    const ctrl = new AddModalController({
      sendImageToAI,
      getConfig: () => defaultCfg(),
      addItem: vi.fn(),
      root: document,
      prompt: IMAGE_EXTRACTION_PROMPT,
    });

    await ctrl.analyzeImage("X");

    const status = document.getElementById("add-ai-status") as HTMLElement;
    const spinner = status.querySelector(".add-ai-spinner") as HTMLElement;
    const text = document.getElementById("add-ai-status-text") as HTMLElement;
    const results = document.getElementById("add-ai-results") as HTMLElement;
    const manual = document.getElementById("add-manual-region") as HTMLElement;

    expect(spinner.hidden).toBe(true);
    expect(status.hidden).toBe(false);
    expect(status.classList.contains("error")).toBe(true);
    expect(text.textContent).toContain("L'analisi IA non è riuscita");
    expect(text.textContent).toContain("manualmente");
    expect(results.hidden).toBe(true);
    expect(manual.hidden).toBe(false);
  });

  it("skips AI call and shows fallback when aiEndpoint is empty", async () => {
    createAddModal();
    const sendImageToAI = vi.fn();
    const ctrl = new AddModalController({
      sendImageToAI,
      getConfig: () => defaultCfg({ aiEndpoint: "" }),
      addItem: vi.fn(),
      root: document,
      prompt: IMAGE_EXTRACTION_PROMPT,
    });

    await ctrl.analyzeImage("X");

    expect(sendImageToAI).not.toHaveBeenCalled();
    const status = document.getElementById("add-ai-status") as HTMLElement;
    const text = document.getElementById("add-ai-status-text") as HTMLElement;
    expect(status.hidden).toBe(false);
    expect(text.textContent).toContain("non è configurata");
  });
});

describe("AddModalController.collectEditedItems", () => {
  it("reads edited values from inputs", async () => {
    createAddModal();
    const ctrl = new AddModalController({
      sendImageToAI: vi.fn(async () => makeResult()),
      getConfig: () => defaultCfg(),
      addItem: vi.fn(),
      root: document,
      prompt: IMAGE_EXTRACTION_PROMPT,
    });
    await ctrl.analyzeImage("X");

    (document.getElementById("add-ai-product") as HTMLInputElement).value = "Latte Bio";
    const firstPrice = document.querySelector(
      "#add-ai-rows .add-ai-row .add-ai-price"
    ) as HTMLInputElement;
    firstPrice.value = "2.50";
    const firstCurrency = document.querySelector(
      "#add-ai-rows .add-ai-row .add-ai-currency"
    ) as HTMLInputElement;
    firstCurrency.value = "USD";

    const items = ctrl.collectEditedItems();
    expect(items.length).toBe(2);
    expect(items[0]).toMatchObject({
      name: "Latte Bio",
      price: 2.5,
      currency: "USD",
      type: "unit_price",
    });
    expect(items[1].price).toBe(2.49);
  });

  it("skips rows where the include checkbox is unchecked", async () => {
    createAddModal();
    const ctrl = new AddModalController({
      sendImageToAI: vi.fn(async () => makeResult()),
      getConfig: () => defaultCfg(),
      addItem: vi.fn(),
      root: document,
      prompt: IMAGE_EXTRACTION_PROMPT,
    });
    await ctrl.analyzeImage("X");

    const rows = document.querySelectorAll(
      "#add-ai-rows .add-ai-row"
    ) as NodeListOf<HTMLTableRowElement>;
    (rows[1].querySelector(".add-ai-include") as HTMLInputElement).checked = false;

    expect(ctrl.collectEditedItems().length).toBe(1);
  });
});

describe("AddModalController.confirmAndAdd", () => {
  it("calls addItem for each row with source 'ai'", async () => {
    createAddModal();
    const added: PriceItem[] = [];
    const ctrl = new AddModalController({
      sendImageToAI: vi.fn(async () => makeResult()),
      getConfig: () => defaultCfg(),
      addItem: (it) => added.push(it),
      root: document,
      prompt: IMAGE_EXTRACTION_PROMPT,
    });

    await ctrl.analyzeImage("X");
    ctrl.confirmAndAdd();

    expect(added.length).toBe(2);
    for (const item of added) {
      expect(item.source).toBe("ai");
      expect(item.currency).toBe("EUR");
      expect(typeof item.confidence).toBe("number");
    }
    expect(added[0].product).toBe("Latte");
    expect(added[0].price).toBe(1.99);
  });

  it("clicking #btn-ai-confirm triggers confirmAndAdd via constructor wiring", async () => {
    createAddModal();
    const addItem = vi.fn();
    const ctrl = new AddModalController({
      sendImageToAI: vi.fn(async () => makeResult()),
      getConfig: () => defaultCfg(),
      addItem,
      root: document,
      prompt: IMAGE_EXTRACTION_PROMPT,
    });
    await ctrl.analyzeImage("X");

    (document.getElementById("btn-ai-confirm") as HTMLButtonElement).click();
    expect(addItem).toHaveBeenCalledTimes(2);

    const results = document.getElementById("add-ai-results") as HTMLElement;
    expect(results.hidden).toBe(true);
  });
});

describe("AddModalController auto-confirm", () => {
  it("auto-adds without manual click when requireManualConfirm is false and confidences are non-zero", async () => {
    createAddModal();
    const addItem = vi.fn();
    const ctrl = new AddModalController({
      sendImageToAI: vi.fn(async () => makeResult()),
      getConfig: () => defaultCfg({ requireManualConfirm: false }),
      addItem,
      root: document,
      prompt: IMAGE_EXTRACTION_PROMPT,
    });

    await ctrl.analyzeImage("X");

    expect(addItem).toHaveBeenCalledTimes(2);
    const results = document.getElementById("add-ai-results") as HTMLElement;
    expect(results.hidden).toBe(true);
  });

  it("does NOT auto-add when a price has zero confidence", async () => {
    createAddModal();
    const addItem = vi.fn();
    const result = makeResult();
    result.products[0].prices[1].confidence = 0;
    const ctrl = new AddModalController({
      sendImageToAI: vi.fn(async () => result),
      getConfig: () => defaultCfg({ requireManualConfirm: false }),
      addItem,
      root: document,
      prompt: IMAGE_EXTRACTION_PROMPT,
    });

    await ctrl.analyzeImage("X");

    expect(addItem).not.toHaveBeenCalled();
    const results = document.getElementById("add-ai-results") as HTMLElement;
    expect(results.hidden).toBe(false);
  });
});

describe("AddModalController.showFallback", () => {
  it("hides AI region without error when called with empty message", () => {
    createAddModal();
    const ctrl = new AddModalController({
      sendImageToAI: vi.fn(),
      getConfig: () => defaultCfg(),
      addItem: vi.fn(),
      root: document,
      prompt: IMAGE_EXTRACTION_PROMPT,
    });

    ctrl.showFallback("");
    const status = document.getElementById("add-ai-status") as HTMLElement;
    const results = document.getElementById("add-ai-results") as HTMLElement;
    expect(status.hidden).toBe(true);
    expect(results.hidden).toBe(true);
    expect(status.classList.contains("error")).toBe(false);
  });

  it("clicking the manual fallback link hides AI region", async () => {
    createAddModal();
    const ctrl = new AddModalController({
      sendImageToAI: vi.fn(async () => makeResult()),
      getConfig: () => defaultCfg(),
      addItem: vi.fn(),
      root: document,
      prompt: IMAGE_EXTRACTION_PROMPT,
    });
    await ctrl.analyzeImage("X");

    (document.getElementById("btn-ai-manual-fallback") as HTMLButtonElement).click();
    const results = document.getElementById("add-ai-results") as HTMLElement;
    expect(results.hidden).toBe(true);
  });
});

