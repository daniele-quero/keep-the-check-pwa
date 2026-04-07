import "./style.css";
import { CameraService } from "./camera";
import { config, CURRENCIES } from "./config";
import { listManager } from "./listManager";
import { recognizeOcr, parseWithGemini, parseWithGroq } from "./api";
import { Modal } from "./modal";
import { createPriceItem, generateId, AiProvider, OcrProvider, CurrencyCode } from "./models";
import type { PriceItem, PriceResult } from "./models";

/* ??? DOM refs ??? */
const video = document.getElementById("preview") as HTMLVideoElement;
const maskTop = document.getElementById("camera-mask-top") as HTMLElement;
const maskBottom = document.getElementById("camera-mask") as HTMLElement;
const spinner = document.getElementById("spinner") as HTMLElement;

const alertEl = document.getElementById("coupon-alert") as HTMLElement;
const couponSection = document.getElementById("coupon-section") as HTMLElement;
const couponValue = document.getElementById("coupon-value") as HTMLElement;
const totalValue = document.getElementById("total-value") as HTMLElement;

const resultList = document.getElementById("result-list") as HTMLElement;
const cropSlider = document.getElementById("crop-slider") as HTMLInputElement;

const btnOptions = document.getElementById("btn-options") as HTMLButtonElement;
const btnAdd = document.getElementById("btn-add") as HTMLButtonElement;
const btnScan = document.getElementById("btn-scan") as HTMLButtonElement;

/* ??? Options modal refs ??? */
const selAi = document.getElementById("opt-ai") as HTMLSelectElement;
const selOcr = document.getElementById("opt-ocr") as HTMLSelectElement;
const selCurrency = document.getElementById("opt-currency") as HTMLSelectElement;
const chkCoupons = document.getElementById("opt-use-coupons") as HTMLInputElement;
const inputCouponVal = document.getElementById("opt-coupon-value") as HTMLInputElement;
const sliderThreshold = document.getElementById("opt-threshold") as HTMLInputElement;
const thresholdLabel = document.getElementById("opt-threshold-value") as HTMLElement;
const inputOcrKey = document.getElementById("opt-ocr-key") as HTMLInputElement;
const inputAiKey = document.getElementById("opt-ai-key") as HTMLInputElement;
const btnOptOk = document.getElementById("opt-ok") as HTMLButtonElement;
const btnOptCancel = document.getElementById("opt-cancel") as HTMLButtonElement;

/* ??? Add modal refs ??? */
const inputProduct = document.getElementById("add-product") as HTMLInputElement;
const inputPrice = document.getElementById("add-price") as HTMLInputElement;
const btnAddOk = document.getElementById("add-ok") as HTMLButtonElement;
const btnAddCancel = document.getElementById("add-cancel") as HTMLButtonElement;

/* ??? Services ??? */
const camera = new CameraService(video);
const optionsModal = new Modal("options-panel", "options-overlay");
const addModal = new Modal("add-panel", "add-overlay");

/* ??? Populate dropdowns ??? */
function populateSelect(sel: HTMLSelectElement, values: string[], selected: string): void {
  sel.innerHTML = "";
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    if (v === selected) opt.selected = true;
    sel.appendChild(opt);
  });
}

function populateOptions(): void {
  const cfg = config.current;
  populateSelect(selAi, Object.values(AiProvider), cfg.aiProvider);
  populateSelect(selOcr, Object.values(OcrProvider), cfg.ocrProvider);
  populateSelect(selCurrency, Object.values(CurrencyCode), cfg.currency);
  inputOcrKey.value = cfg.ocrApiKeys[cfg.ocrProvider] ?? "";
  inputAiKey.value = cfg.aiApiKeys[cfg.aiProvider] ?? "";
  chkCoupons.checked = cfg.useCoupons;
  inputCouponVal.value = cfg.couponValue.toFixed(2);
  sliderThreshold.value = String(cfg.couponAlertThreshold);
  updateThresholdLabel(cfg.couponAlertThreshold);
}

selAi.addEventListener("change", () => {
  inputAiKey.value = config.current.aiApiKeys[selAi.value] ?? "";
});

selOcr.addEventListener("change", () => {
  inputOcrKey.value = config.current.ocrApiKeys[selOcr.value] ?? "";
});

function updateThresholdLabel(val: number): void {
  thresholdLabel.textContent = `${Math.round(val * 100)}%`;
}

/* ??? Crop slider ??? */
cropSlider.addEventListener("input", () => {
  const v = parseFloat(cropSlider.value);
  const maskPercent = (v * 75) / 2;
  maskTop.style.height = `${maskPercent}%`;
  maskBottom.style.height = `${maskPercent}%`;
});

/* ??? Totals update ??? */
listManager.onTotalUpdated((total, coupons) => {
  totalValue.textContent = `${total.toFixed(2)} ${config.getCurrencySymbol()}`;

  if (config.current.useCoupons) {
    couponSection.classList.add("visible");
    couponValue.textContent = coupons > 0 ? `x${coupons}` : "";
  } else {
    couponSection.classList.remove("visible");
  }
});

listManager.onCouponAlert((show, remaining) => {
  if (show && config.current.useCoupons) {
    alertEl.textContent = `Add just ${remaining.toFixed(2)} ${config.getCurrencySymbol()} more to get another coupon!`;
  } else {
    alertEl.textContent = "";
  }
});

config.onChanged(() => {
  listManager.recalculate();
});

/* ??? Result list ??? */
function addResultItem(item: PriceItem, isError = false): void {
  const div = document.createElement("div");
  div.className = `result-item${isError ? " error" : ""}`;
  div.dataset.id = String(item.id);

  const productSpan = document.createElement("span");
  productSpan.className = "product";
  productSpan.textContent = item.product;

  const priceSpan = document.createElement("span");
  priceSpan.className = "price";
  priceSpan.textContent = isError ? "" : `${item.price.toFixed(2)} ${config.getCurrencySymbol()}`;

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "\u00D7";
  removeBtn.addEventListener("click", () => {
    if (!isError) listManager.removeItem(item.id);
    div.remove();
  });

  div.appendChild(productSpan);
  div.appendChild(priceSpan);
  div.appendChild(removeBtn);
  resultList.appendChild(div);

  if (!isError) {
    listManager.addItem(item);
  }
}

/* ??? AI with fallback ??? */
async function callAiWithFallback(ocrText: string): Promise<PriceResult> {
  const primary = config.current.aiProvider;
  const fallback = primary === AiProvider.Groq ? AiProvider.Gemini : AiProvider.Groq;
  const primaryKey = config.getAiApiKey();

  try {
    return primary === AiProvider.Groq
      ? await parseWithGroq(ocrText, primaryKey)
      : await parseWithGemini(ocrText, primaryKey);
  } catch (primaryErr) {
    const fallbackKey = config.current.aiApiKeys[fallback] ?? "";
    if (!fallbackKey) throw primaryErr;
    return fallback === AiProvider.Groq
      ? await parseWithGroq(ocrText, fallbackKey)
      : await parseWithGemini(ocrText, fallbackKey);
  }
}

/* ??? Scan ??? */
let scanning = false;

async function doScan(): Promise<void> {
  if (scanning) return;
  scanning = true;
  spinner.classList.add("active");
  btnScan.disabled = true;

  try {
    const cropVal = parseFloat(cropSlider.value);
    const base64 = camera.captureCropped(cropVal);
    if (!base64) throw new Error("Camera capture failed");

    const ocrText = await recognizeOcr(base64, config.getOcrApiKey());

    const result = await callAiWithFallback(ocrText);

    for (const item of result.items) {
      const priceItem = createPriceItem(item.product, item.price);
      addResultItem(priceItem);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addResultItem({ id: generateId(), product: `[Error] ${msg}`, price: 0 }, true);
  } finally {
    scanning = false;
    spinner.classList.remove("active");
    btnScan.disabled = false;
  }
}

btnScan.addEventListener("click", doScan);

/* ??? Options modal ??? */
btnOptions.addEventListener("click", () => {
  populateOptions();
  optionsModal.open();
});

sliderThreshold.addEventListener("input", () => {
  const raw = parseFloat(sliderThreshold.value);
  const stepped = Math.round(raw / 0.05) * 0.05;
  const clamped = Math.max(0.05, Math.min(0.30, stepped));
  sliderThreshold.value = String(clamped);
  updateThresholdLabel(clamped);
});

btnOptOk.addEventListener("click", () => {
  const updatedAiKeys = { ...config.current.aiApiKeys, [selAi.value]: inputAiKey.value.trim() };
  const updatedOcrKeys = { ...config.current.ocrApiKeys, [selOcr.value]: inputOcrKey.value.trim() };
  config.save({
    aiProvider: selAi.value as AiProvider,
    ocrProvider: selOcr.value as OcrProvider,
    currency: selCurrency.value as CurrencyCode,
    ocrApiKeys: updatedOcrKeys,
    aiApiKeys: updatedAiKeys,
    useCoupons: chkCoupons.checked,
    couponValue: parseFloat(inputCouponVal.value) || 0,
    couponAlertThreshold: parseFloat(sliderThreshold.value) || 0.2,
  });
  optionsModal.close();
});

btnOptCancel.addEventListener("click", () => {
  optionsModal.close();
});

/* ??? Add modal ??? */
btnAdd.addEventListener("click", () => {
  inputProduct.value = "";
  inputPrice.value = "";
  addModal.open();
});

btnAddOk.addEventListener("click", () => {
  const product = inputProduct.value.trim();
  const priceText = inputPrice.value.trim().replace(",", ".");
  if (!product || !priceText) return;

  const price = parseFloat(priceText);
  if (isNaN(price) || price <= 0) return;

  const item = createPriceItem(product, price);
  addResultItem(item);
  addModal.close();
});

btnAddCancel.addEventListener("click", () => {
  addModal.close();
});

/* ??? Camera init ??? */
camera.start().catch((err) => {
  console.warn("Camera start failed:", err);
});

/* ??? Init totals ??? */
totalValue.textContent = `0.00 ${config.getCurrencySymbol()}`;

/* ??? Service Worker ??? */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
