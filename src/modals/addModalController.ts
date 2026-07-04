import type { AiExtractionResult, AiPrice } from "../aiPrompt";
import type { SendImageToAIOptions } from "../api";
import type { PriceItem } from "../models";
import { createItemFromAi } from "../models";

export interface AddModalControllerConfig {
  proxyEndpoint: string;
  selectedProviderId?: string;
  hasAnyProviderWithKey: boolean;
  aiTimeoutMs: number;
  requireManualConfirm: boolean;
}

export type SendImageToAIFn = (
  base64: string,
  prompt: string,
  opts: SendImageToAIOptions
) => Promise<AiExtractionResult>;

export interface AddModalControllerDeps {
  sendImageToAI: SendImageToAIFn;
  getConfig: () => AddModalControllerConfig;
  addItem: (item: PriceItem) => void;
  root: ParentNode;
  prompt: string;
  onConfirmed?: () => void;
  onFallback?: () => void;
}

export interface CollectedItem {
  name: string;
  price: number;
  currency: string | null;
  confidence: number;
  type: string;
}

const PRICE_TYPES = [
  "unit_price",
  "total_price",
  "discount_price",
  "old_price",
  "price_per_unit",
  "other",
] as const;

const FALLBACK_MESSAGE_DEFAULT =
  "L'analisi IA non è riuscita. Inserisci i dati manualmente.";
const FALLBACK_MESSAGE_NO_ENDPOINT =
  "L'analisi IA non è configurata. Inserisci i dati manualmente.";
const STATUS_MESSAGE_ANALYZING = "Analisi IA in corso…";

export function shouldAutoConfirmAiResult(
  result: AiExtractionResult,
  requireManualConfirm: boolean
): boolean {
  if (requireManualConfirm) return false;

  const singleProduct = result.products.length === 1;
  const noZeroConfidence = result.products.every((p) =>
    p.prices.every((pr) => (pr.confidence ?? 0) > 0)
  );

  return singleProduct && noZeroConfidence;
}

export function shouldOpenAddModalAfterScan(
  result: AiExtractionResult | null,
  requireManualConfirm: boolean
): boolean {
  if (!result) return true;
  return !shouldAutoConfirmAiResult(result, requireManualConfirm);
}

export class AddModalController {
  private readonly deps: AddModalControllerDeps;
  private wired = false;

  constructor(deps: AddModalControllerDeps) {
    this.deps = deps;
    this.wireButtons();
  }

  private q<T extends Element = HTMLElement>(sel: string): T | null {
    return this.deps.root.querySelector(sel) as T | null;
  }

  private require<T extends Element = HTMLElement>(sel: string): T {
    const el = this.q<T>(sel);
    if (!el) throw new Error(`AddModalController: missing element ${sel}`);
    return el;
  }

  private wireButtons(): void {
    if (this.wired) return;
    const confirm = this.q<HTMLButtonElement>("#btn-ai-confirm");
    const fallback = this.q<HTMLButtonElement>("#btn-ai-manual-fallback");
    if (confirm) {
      confirm.addEventListener("click", () => this.confirmAndAdd());
    }
    if (fallback) {
      fallback.addEventListener("click", () => {
        this.showFallback("");
        this.deps.onFallback?.();
      });
    }
    this.wired = true;
  }

  reset(): void {
    const status = this.q<HTMLElement>("#add-ai-status");
    const results = this.q<HTMLElement>("#add-ai-results");
    if (status) {
      status.hidden = true;
      status.classList.remove("error");
      this.setStatusMessage(STATUS_MESSAGE_ANALYZING);
      const spinner = status.querySelector<HTMLElement>(".add-ai-spinner");
      if (spinner) spinner.hidden = false;
    }
    if (results) {
      results.hidden = true;
      const tbody = results.querySelector<HTMLElement>("#add-ai-rows");
      if (tbody) tbody.innerHTML = "";
      const productInput = results.querySelector<HTMLInputElement>("#add-ai-product");
      if (productInput) productInput.value = "";
    }
  }

  async analyzeImage(imageBase64: string): Promise<AiExtractionResult | null> {
    const cfg = this.deps.getConfig();
    const likelyNoProviderConfigured = !cfg.hasAnyProviderWithKey;

    this.showAnalyzing();

    let result: AiExtractionResult;
    try {
      result = await this.deps.sendImageToAI(imageBase64, this.deps.prompt, {
        endpoint: cfg.proxyEndpoint,
        useProxy: true,
        timeoutMs: cfg.aiTimeoutMs,
        extraHeaders: cfg.selectedProviderId
          ? { "X-Provider-Id": cfg.selectedProviderId }
          : undefined,
      });
    } catch {
      this.showFallback(
        likelyNoProviderConfigured
          ? FALLBACK_MESSAGE_NO_ENDPOINT
          : FALLBACK_MESSAGE_DEFAULT
      );
      return null;
    }

    this.hideStatus();
    this.renderResults(result);

    if (shouldAutoConfirmAiResult(result, cfg.requireManualConfirm)) {
      this.confirmAndAdd();
    }

    return result;
  }

  renderResults(result: AiExtractionResult): void {
    const results = this.require<HTMLElement>("#add-ai-results");
    const productInput = this.require<HTMLInputElement>("#add-ai-product");
    const tbody = this.require<HTMLElement>("#add-ai-rows");

    const firstProduct = result.products[0];
    productInput.value = (firstProduct?.name ?? firstProduct?.name_raw ?? "").trim();

    tbody.innerHTML = "";
    for (const product of result.products) {
      for (const price of product.prices) {
        tbody.appendChild(this.buildRow(price));
      }
    }

    results.hidden = false;
    this.hideStatus();
  }

  private buildRow(price: AiPrice): HTMLTableRowElement {
    const row = document.createElement("tr");
    row.className = "add-ai-row";

    const includeCell = document.createElement("td");
    const includeCb = document.createElement("input");
    includeCb.type = "checkbox";
    includeCb.checked = true;
    includeCb.className = "add-ai-include";
    includeCell.appendChild(includeCb);
    row.appendChild(includeCell);

    const priceCell = document.createElement("td");
    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.step = "0.01";
    priceInput.min = "0";
    priceInput.className = "add-ai-price";
    priceInput.value = Number.isFinite(price.normalized)
      ? String(price.normalized)
      : "0";
    priceCell.appendChild(priceInput);
    row.appendChild(priceCell);

    const curCell = document.createElement("td");
    const curInput = document.createElement("input");
    curInput.type = "text";
    curInput.className = "add-ai-currency";
    curInput.maxLength = 8;
    curInput.value = price.currency ?? "";
    curCell.appendChild(curInput);
    row.appendChild(curCell);

    const typeCell = document.createElement("td");
    const typeSel = document.createElement("select");
    typeSel.className = "add-ai-type";
    for (const t of PRICE_TYPES) {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      if (t === price.type) opt.selected = true;
      typeSel.appendChild(opt);
    }
    typeCell.appendChild(typeSel);
    row.appendChild(typeCell);

    const confCell = document.createElement("td");
    confCell.className = "add-ai-confidence";
    const confVal = typeof price.confidence === "number" ? price.confidence : 0;
    confCell.textContent = confVal.toFixed(2);
    confCell.dataset.confidence = String(confVal);
    row.appendChild(confCell);

    const delCell = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "add-ai-del";
    delBtn.textContent = "\u00D7";
    delBtn.addEventListener("click", () => row.remove());
    delCell.appendChild(delBtn);
    row.appendChild(delCell);

    return row;
  }

  collectEditedItems(): CollectedItem[] {
    const productInput = this.q<HTMLInputElement>("#add-ai-product");
    const name = (productInput?.value ?? "").trim();
    const tbody = this.q<HTMLElement>("#add-ai-rows");
    if (!tbody) return [];

    const rows = Array.from(
      tbody.querySelectorAll<HTMLTableRowElement>(".add-ai-row")
    );
    const out: CollectedItem[] = [];
    for (const row of rows) {
      const include = row.querySelector<HTMLInputElement>(".add-ai-include");
      if (include && !include.checked) continue;

      const priceEl = row.querySelector<HTMLInputElement>(".add-ai-price");
      const rawPrice = (priceEl?.value ?? "").replace(",", ".").trim();
      const price = parseFloat(rawPrice);
      if (!Number.isFinite(price)) continue;

      const curEl = row.querySelector<HTMLInputElement>(".add-ai-currency");
      const currencyRaw = (curEl?.value ?? "").trim();

      const typeEl = row.querySelector<HTMLSelectElement>(".add-ai-type");
      const type = typeEl?.value ?? "other";

      const confEl = row.querySelector<HTMLElement>(".add-ai-confidence");
      const confidence =
        parseFloat(confEl?.dataset?.confidence ?? confEl?.textContent ?? "0") || 0;

      out.push({
        name,
        price,
        currency: currencyRaw === "" ? null : currencyRaw,
        confidence,
        type,
      });
    }
    return out;
  }

  confirmAndAdd(): void {
    const items = this.collectEditedItems();
    for (const it of items) {
      const priceItem = createItemFromAi({
        name: it.name,
        price: it.price,
        currency: it.currency,
        confidence: it.confidence,
      });
      this.deps.addItem(priceItem);
    }
    const results = this.q<HTMLElement>("#add-ai-results");
    if (results) results.hidden = true;
    this.hideStatus();
    this.deps.onConfirmed?.();
  }

  showFallback(message: string): void {
    const status = this.q<HTMLElement>("#add-ai-status");
    const results = this.q<HTMLElement>("#add-ai-results");
    if (results) results.hidden = true;

    if (!status) return;
    const spinner = status.querySelector<HTMLElement>(".add-ai-spinner");
    if (spinner) spinner.hidden = true;

    if (message && message.trim() !== "") {
      this.setStatusMessage(message);
      status.classList.add("error");
      status.hidden = false;
    } else {
      status.hidden = true;
      status.classList.remove("error");
    }
  }

  private showAnalyzing(): void {
    const status = this.require<HTMLElement>("#add-ai-status");
    const results = this.q<HTMLElement>("#add-ai-results");
    if (results) results.hidden = true;
    status.classList.remove("error");
    const spinner = status.querySelector<HTMLElement>(".add-ai-spinner");
    if (spinner) spinner.hidden = false;
    this.setStatusMessage(STATUS_MESSAGE_ANALYZING);
    status.hidden = false;
  }

  private hideStatus(): void {
    const status = this.q<HTMLElement>("#add-ai-status");
    if (status) status.hidden = true;
  }

  private setStatusMessage(text: string): void {
    const el = this.q<HTMLElement>("#add-ai-status-text");
    if (el) el.textContent = text;
  }
}
