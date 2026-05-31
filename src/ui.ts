import { listManager } from "./listManager";
import { config } from "./config";
import { generateId } from "./models";
import type { PriceItem } from "./models";
export function addResultItem(item: PriceItem, isError = false, onEdit?: (item: PriceItem) => void): void {
  const div = document.createElement("div");
  div.className = `result-item${isError ? " error" : ""}`;
  div.dataset.id = String(item.id);

  const productSpan = document.createElement("span");
  productSpan.className = "product";
  productSpan.textContent = item.product;
  if (!isError && onEdit) {
    productSpan.style.cursor = "pointer";
    productSpan.addEventListener("click", () => onEdit(item));
  }

  const priceSpan = document.createElement("span");
  priceSpan.className = "price";
  priceSpan.textContent = isError ? "" : `${(item.price * item.quantity).toFixed(2)} ${config.getCurrencySymbol()}`;

  div.appendChild(productSpan);

  if (!isError) {
    const qtyControls = document.createElement("div");
    qtyControls.className = "qty-controls";

    const minusBtn = document.createElement("button");
    minusBtn.className = "qty-btn";
    minusBtn.textContent = "−";

    const qtyValue = document.createElement("span");
    qtyValue.className = "qty-value";
    qtyValue.textContent = String(item.quantity);

    const plusBtn = document.createElement("button");
    plusBtn.className = "qty-btn";
    plusBtn.textContent = "+";

    minusBtn.addEventListener("click", () => {
      listManager.changeQuantity(item.id, -1);
      qtyValue.textContent = String(item.quantity);
      priceSpan.textContent = `${(item.price * item.quantity).toFixed(2)} ${config.getCurrencySymbol()}`;
    });

    plusBtn.addEventListener("click", () => {
      listManager.changeQuantity(item.id, +1);
      qtyValue.textContent = String(item.quantity);
      priceSpan.textContent = `${(item.price * item.quantity).toFixed(2)} ${config.getCurrencySymbol()}`;
    });

    qtyControls.appendChild(minusBtn);
    qtyControls.appendChild(qtyValue);
    qtyControls.appendChild(plusBtn);
    div.appendChild(qtyControls);
  }

  div.appendChild(priceSpan);

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "\u00D7";
  removeBtn.addEventListener("click", () => {
    if (!isError) listManager.removeItem(item.id);
    div.remove();
  });

  div.appendChild(removeBtn);
  uiRefs.resultList.appendChild(div);

  if (!isError) {
    listManager.addItem(item);
  }
}
// UI DOM refs and helpers for Keep The Check
// import { config } from "./config";

export const uiRefs = {
  get video()          { return document.getElementById("preview") as HTMLVideoElement; },
  get maskTop()        { return document.getElementById("camera-mask-top") as HTMLElement; },
  get maskBottom()     { return document.getElementById("camera-mask") as HTMLElement; },
  get spinner()        { return document.getElementById("spinner") as HTMLElement; },
  get alertEl()        { return document.getElementById("coupon-alert") as HTMLElement; },
  get cashSection()    { return document.getElementById("cash-section") as HTMLElement; },
  get cashValue()      { return document.getElementById("cash-value") as HTMLElement; },
  get couponSection()  { return document.getElementById("coupon-section") as HTMLElement; },
  get couponValue()    { return document.getElementById("coupon-value") as HTMLElement; },
  get totalValue()     { return document.getElementById("total-value") as HTMLElement; },
  get resultList()     { return document.getElementById("result-list") as HTMLElement; },
  get cropSlider()     { return document.getElementById("crop-slider") as HTMLInputElement; },
  get btnOptions()     { return document.getElementById("btn-options") as HTMLButtonElement; },
  get btnAdd()         { return document.getElementById("btn-add") as HTMLButtonElement; },
  get btnScan()        { return document.getElementById("btn-scan") as HTMLButtonElement; },
  get btnTutorial()    { return document.getElementById("btn-tutorial") as HTMLButtonElement; },
  get selCurrency()    { return document.getElementById("opt-currency") as HTMLSelectElement; },
  get chkCoupons()     { return document.getElementById("opt-use-coupons") as HTMLInputElement; },
  get inputCouponVal() { return document.getElementById("opt-coupon-value") as HTMLInputElement; },
  get sliderThreshold(){ return document.getElementById("opt-threshold") as HTMLInputElement; },
  get thresholdLabel() { return document.getElementById("opt-threshold-value") as HTMLElement; },
  get inputAiEndpoint(){ return document.getElementById("opt-ai-endpoint") as HTMLInputElement; },
  get inputAiModel()   { return document.getElementById("opt-ai-model") as HTMLInputElement; },
  get inputAiApiKey()  { return document.getElementById("opt-ai-api-key") as HTMLInputElement; },
  get inputAiTimeout() { return document.getElementById("opt-ai-timeout") as HTMLInputElement; },
  get chkAiUseProxy()  { return document.getElementById("opt-ai-use-proxy") as HTMLInputElement; },
  get chkRequireManualConfirm() { return document.getElementById("opt-require-manual-confirm") as HTMLInputElement; },
  get inputImport()    { return document.getElementById("opt-import") as HTMLInputElement; },
  get btnOptExport()   { return document.getElementById("opt-export") as HTMLButtonElement; },
  get btnOptOk()       { return document.getElementById("opt-ok") as HTMLButtonElement; },
  get btnOptCancel()   { return document.getElementById("opt-cancel") as HTMLButtonElement; },
  get inputProduct()   { return document.getElementById("add-product") as HTMLTextAreaElement; },
  get inputPrice()     { return document.getElementById("add-price") as HTMLInputElement; },
  get btnAddOk()       { return document.getElementById("add-ok") as HTMLButtonElement; },
  get btnAddCancel()   { return document.getElementById("add-cancel") as HTMLButtonElement; },
  get addQtyMinus()    { return document.getElementById("add-qty-minus") as HTMLButtonElement; },
  get addQtyPlus()     { return document.getElementById("add-qty-plus") as HTMLButtonElement; },
  get addQtyDisplay()  { return document.getElementById("add-qty-display") as HTMLElement; },
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
