import { listManager } from "./listManager";
import { config } from "./config";
import { generateId } from "./models";
import type { PriceItem } from "./models";
export function addResultItem(item: PriceItem, isError = false): void {
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
  uiRefs.resultList.appendChild(div);

  if (!isError) {
    listManager.addItem(item);
  }
}
// UI DOM refs and helpers for Keep The Check
import { AiProvider, OcrProvider, CurrencyCode } from "./models";
// import { config } from "./config";

export const uiRefs = {
  video: document.getElementById("preview") as HTMLVideoElement,
  maskTop: document.getElementById("camera-mask-top") as HTMLElement,
  maskBottom: document.getElementById("camera-mask") as HTMLElement,
  spinner: document.getElementById("spinner") as HTMLElement,
  alertEl: document.getElementById("coupon-alert") as HTMLElement,
  couponSection: document.getElementById("coupon-section") as HTMLElement,
  couponValue: document.getElementById("coupon-value") as HTMLElement,
  totalValue: document.getElementById("total-value") as HTMLElement,
  resultList: document.getElementById("result-list") as HTMLElement,
  cropSlider: document.getElementById("crop-slider") as HTMLInputElement,
  btnOptions: document.getElementById("btn-options") as HTMLButtonElement,
  btnAdd: document.getElementById("btn-add") as HTMLButtonElement,
  btnScan: document.getElementById("btn-scan") as HTMLButtonElement,
  selAi: document.getElementById("opt-ai") as HTMLSelectElement,
  selOcr: document.getElementById("opt-ocr") as HTMLSelectElement,
  selCurrency: document.getElementById("opt-currency") as HTMLSelectElement,
  chkCoupons: document.getElementById("opt-use-coupons") as HTMLInputElement,
  inputCouponVal: document.getElementById("opt-coupon-value") as HTMLInputElement,
  sliderThreshold: document.getElementById("opt-threshold") as HTMLInputElement,
  thresholdLabel: document.getElementById("opt-threshold-value") as HTMLElement,
  inputOcrKey: document.getElementById("opt-ocr-key") as HTMLInputElement,
  inputAiKey: document.getElementById("opt-ai-key") as HTMLInputElement,
  inputImport: document.getElementById("opt-import") as HTMLInputElement,
  btnOptExport: document.getElementById("opt-export") as HTMLButtonElement,
  btnOptOk: document.getElementById("opt-ok") as HTMLButtonElement,
  btnOptCancel: document.getElementById("opt-cancel") as HTMLButtonElement,
  inputProduct: document.getElementById("add-product") as HTMLTextAreaElement,
  inputPrice: document.getElementById("add-price") as HTMLInputElement,
  btnAddOk: document.getElementById("add-ok") as HTMLButtonElement,
  btnAddCancel: document.getElementById("add-cancel") as HTMLButtonElement,
};

export function populateSelect(sel: HTMLSelectElement, values: string[], selected: string): void {
  sel.innerHTML = "";
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    if (v === selected) opt.selected = true;
    sel.appendChild(opt);
  });
}

export function updateThresholdLabel(val: number, labelEl: HTMLElement): void {
  labelEl.textContent = `${Math.round(val * 100)}%`;
}
