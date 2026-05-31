import "./style.css";
import { CameraService } from "./camera";
import { AI_PROVIDER_PRESETS, config, type ProviderConfig } from "./config";
import { listManager } from "./listManager";
import { sendImageToAI } from "./api";
import { createOptionsModal, initOptionTooltips } from "./modals/optionsModal";
import { createAddModal } from "./modals/addModal";
import { AddModalController } from "./modals/addModalController";
import { IMAGE_EXTRACTION_PROMPT } from "./aiPrompt";
import { createPriceItem, generateId, CurrencyCode } from "./models";
import type { PriceItem } from "./models";
import { uiRefs, populateSelect, updateThresholdLabel, addResultItem } from "./ui";
import { parseSimpleYaml, applyYamlToModal, exportConfigYaml } from "./yamlConfig";
import { createTutorialModal, initTutorialLang } from "./modals/tutorialModal";



/* ??? Services ??? */
const camera = new CameraService(uiRefs.video);
const optionsModal = createOptionsModal();
initOptionTooltips();
const addModal = createAddModal();
const tutorialModal = createTutorialModal();

initTutorialLang();

function getProviderInput(id: string, field: string): HTMLInputElement {
  return document.getElementById(`opt-provider-${id}-${field}`) as HTMLInputElement;
}

function getProviderConfig(providers: readonly ProviderConfig[], id: string): ProviderConfig {
  return (
    providers.find((provider) => provider.id === id) ??
    AI_PROVIDER_PRESETS.find((provider) => provider.id === id)!
  );
}

function populateProviderOptions(providers: readonly ProviderConfig[]): void {
  for (const preset of AI_PROVIDER_PRESETS) {
    const provider = getProviderConfig(providers, preset.id);
    getProviderInput(preset.id, "enabled").checked = provider.enabled;
    getProviderInput(preset.id, "use-proxy").checked = provider.useProxy;
    getProviderInput(preset.id, "priority").value = String(provider.priority);
    getProviderInput(preset.id, "timeout").value = String(provider.timeoutMs);
    getProviderInput(preset.id, "endpoint").value = provider.endpointTemplate;
    getProviderInput(preset.id, "model").value = provider.model;
    getProviderInput(preset.id, "api-key").value = provider.apiKey;
  }
}

function readProviderOptions(): ProviderConfig[] {
  const providers = AI_PROVIDER_PRESETS.map((preset) => {
    const enabled = getProviderInput(preset.id, "enabled").checked;
    const useProxy = getProviderInput(preset.id, "use-proxy").checked;
    const priority = Math.max(
      1,
      parseInt(getProviderInput(preset.id, "priority").value, 10) || preset.priority
    );
    const timeoutMs = Math.max(
      1000,
      parseInt(getProviderInput(preset.id, "timeout").value, 10) || preset.timeoutMs
    );
    const endpointTemplate =
      getProviderInput(preset.id, "endpoint").value.trim() || preset.endpointTemplate;
    const model = getProviderInput(preset.id, "model").value.trim() || preset.model;
    const apiKey = getProviderInput(preset.id, "api-key").value.trim();

    return {
      ...preset,
      enabled,
      useProxy,
      priority,
      timeoutMs,
      endpointTemplate,
      model,
      apiKey,
    };
  });

  return providers.sort((a, b) => a.priority - b.priority);
}

/* ??? Populate dropdowns ??? */

function populateOptions(): void {
  const cfg = config.current;
  populateSelect(uiRefs.selCurrency, Object.values(CurrencyCode), cfg.currency);
  uiRefs.chkCoupons.checked = cfg.useCoupons;
  uiRefs.inputCouponVal.value = cfg.couponValue.toFixed(2);
  uiRefs.sliderThreshold.value = String(cfg.couponAlertThreshold);
  updateThresholdLabel(cfg.couponAlertThreshold, uiRefs.thresholdLabel);
  uiRefs.inputAiEndpoint.value = cfg.aiEndpoint;
  uiRefs.inputAiModel.value = cfg.aiModel;
  uiRefs.inputAiApiKey.value = cfg.aiApiKey;
  uiRefs.inputAiTimeout.value = String(cfg.aiTimeoutMs);
  uiRefs.chkAiUseProxy.checked = cfg.aiUseProxy;
  uiRefs.chkRequireManualConfirm.checked = cfg.requireManualConfirm;
  populateProviderOptions(cfg.aiProviders);
}




uiRefs.inputImport.addEventListener("change", () => {
  const file = uiRefs.inputImport.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = parseSimpleYaml(reader.result as string);
      applyYamlToModal(data, uiRefs);
    } catch { /* ignore malformed files */ }
    uiRefs.inputImport.value = "";
  };
  reader.readAsText(file);
});

uiRefs.btnOptExport.addEventListener("click", () => {
  const yml = exportConfigYaml(config.current);
  const blob = new Blob([yml], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "config.yml";
  a.click();
  URL.revokeObjectURL(url);
});



/* ??? Crop slider ??? */
uiRefs.cropSlider.addEventListener("input", () => {
  const v = parseFloat(uiRefs.cropSlider.value);
  const maskPercent = (v * 75) / 2;
  uiRefs.maskTop.style.height = `${maskPercent}%`;
  uiRefs.maskBottom.style.height = `${maskPercent}%`;
});

/* ??? Totals update ??? */

listManager.onTotalUpdated((total, coupons) => {
  uiRefs.totalValue.textContent = `${total.toFixed(2)} ${config.getCurrencySymbol()}`;

  if (config.current.useCoupons) {
    uiRefs.couponSection.classList.add("visible");
    uiRefs.couponValue.textContent = coupons > 0 ? `x${coupons}` : "";

    if (coupons > 0) {
      const cash = total - coupons * config.current.couponValue;
      uiRefs.cashSection.classList.add("visible");
      uiRefs.cashValue.textContent = `${cash.toFixed(2)} ${config.getCurrencySymbol()}`;
    } else {
      uiRefs.cashSection.classList.remove("visible");
    }
  } else {
    uiRefs.couponSection.classList.remove("visible");
    uiRefs.cashSection.classList.remove("visible");
  }
});


listManager.onCouponAlert((show, remaining) => {
  if (show && config.current.useCoupons) {
    uiRefs.alertEl.textContent = `Add just ${remaining.toFixed(2)} ${config.getCurrencySymbol()} more to get another coupon!`;
  } else {
    uiRefs.alertEl.textContent = "";
  }
});

config.onChanged(() => {
  listManager.recalculate();
});

/* ??? Tutorial modal ??? */
uiRefs.btnTutorial.addEventListener("click", () => {
  tutorialModal.open();
});

(document.getElementById("tutorial-close") as HTMLButtonElement).addEventListener("click", () => {
  tutorialModal.close();
});

/* ??? Scan ??? */

let scanning = false;

const addModalController = new AddModalController({
  sendImageToAI,
  getConfig: () => ({
    aiEndpoint: config.current.aiEndpoint,
    aiApiKey: config.current.aiApiKey,
    aiModel: config.current.aiModel,
    aiTimeoutMs: config.current.aiTimeoutMs,
    aiUseProxy: config.current.aiUseProxy,
    aiProviders: config.current.aiProviders,
    requireManualConfirm: config.current.requireManualConfirm,
  }),
  addItem: (item) => addResultItem(item, false, openEditModal),
  root: document,
  prompt: IMAGE_EXTRACTION_PROMPT,
  onConfirmed: () => addModal.close(),
});

async function doScan(): Promise<void> {
  if (scanning) return;
  scanning = true;
  uiRefs.btnScan.disabled = true;

  try {
    const cropVal = parseFloat(uiRefs.cropSlider.value);
    const base64 = camera.captureCropped(cropVal);
    if (!base64) throw new Error("Camera capture failed");

    addModalController.reset();
    editingItemId = null;
    addModal.open();
    await addModalController.analyzeImage(base64);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addResultItem({ id: generateId(), product: `[Error] ${msg}`, price: 0, quantity: 1 }, true);
  } finally {
    scanning = false;
    uiRefs.btnScan.disabled = false;
  }
}

uiRefs.btnScan.addEventListener("click", doScan);

/* ??? Options modal ??? */
uiRefs.btnOptions.addEventListener("click", () => {
  populateOptions();
  optionsModal.open();
});

uiRefs.sliderThreshold.addEventListener("input", () => {
  const raw = parseFloat(uiRefs.sliderThreshold.value);
  const stepped = Math.round(raw / 0.05) * 0.05;
  const clamped = Math.max(0.05, Math.min(0.30, stepped));
  uiRefs.sliderThreshold.value = String(clamped);
  updateThresholdLabel(clamped, uiRefs.thresholdLabel);
});

uiRefs.btnOptOk.addEventListener("click", () => {
  const aiProviders = readProviderOptions();
  config.save({
    currency: uiRefs.selCurrency.value as CurrencyCode,
    useCoupons: uiRefs.chkCoupons.checked,
    couponValue: parseFloat(uiRefs.inputCouponVal.value) || 0,
    couponAlertThreshold: parseFloat(uiRefs.sliderThreshold.value) || 0.2,
    aiEndpoint: uiRefs.inputAiEndpoint.value.trim(),
    aiModel: uiRefs.inputAiModel.value.trim(),
    aiApiKey: uiRefs.inputAiApiKey.value.trim(),
    aiTimeoutMs: Math.max(1000, parseInt(uiRefs.inputAiTimeout.value, 10) || 30000),
    aiUseProxy: uiRefs.chkAiUseProxy.checked,
    aiProviders,
    requireManualConfirm: uiRefs.chkRequireManualConfirm.checked,
  });
  optionsModal.close();
});

uiRefs.btnOptCancel.addEventListener("click", () => {
  optionsModal.close();
});

/* ??? Add modal ??? */
let addQty = 1;
let editingItemId: number | null = null;

function openEditModal(item: PriceItem): void {
  editingItemId = item.id;
  uiRefs.inputProduct.value = item.product;
  uiRefs.inputPrice.value = String(item.price);
  addQty = item.quantity;
  uiRefs.addQtyDisplay.textContent = String(item.quantity);
  addModalController.reset();
  addModal.open();
}

uiRefs.btnAdd.addEventListener("click", () => {
  editingItemId = null;
  uiRefs.inputProduct.value = "";
  uiRefs.inputPrice.value = "";
  addQty = 1;
  uiRefs.addQtyDisplay.textContent = "1";
  addModalController.reset();
  addModal.open();
});

uiRefs.addQtyMinus.addEventListener("click", () => {
  if (addQty > 1) {
    addQty--;
    uiRefs.addQtyDisplay.textContent = String(addQty);
  }
});

uiRefs.addQtyPlus.addEventListener("click", () => {
  addQty++;
  uiRefs.addQtyDisplay.textContent = String(addQty);
});

uiRefs.btnAddOk.addEventListener("click", () => {
  const product = uiRefs.inputProduct.value.replace(/\n/g, " ").trim();
  const priceText = uiRefs.inputPrice.value.trim().replace(",", ".");
  if (!product || !priceText) return;

  const price = parseFloat(priceText);
  if (isNaN(price) || price <= 0) return;

  if (editingItemId !== null) {
    listManager.updateItem(editingItemId, product, price, addQty);
    const row = uiRefs.resultList.querySelector(`[data-id="${editingItemId}"]`) as HTMLElement | null;
    if (row) {
      (row.querySelector(".product") as HTMLElement).textContent = product;
      (row.querySelector(".qty-value") as HTMLElement).textContent = String(addQty);
      (row.querySelector(".price") as HTMLElement).textContent = `${(price * addQty).toFixed(2)} ${config.getCurrencySymbol()}`;
    }
    editingItemId = null;
  } else {
    const item = createPriceItem(product, price);
    item.quantity = addQty;
    addResultItem(item, false, openEditModal);
  }
  addModal.close();
});

uiRefs.btnAddCancel.addEventListener("click", () => {
  editingItemId = null;
  addModal.close();
});

/* ??? Camera init ??? */
camera.start().catch((err) => {
  console.warn("Camera start failed:", err);
});

/* ??? Init totals ??? */
uiRefs.totalValue.textContent = `0.00 ${config.getCurrencySymbol()}`;

/* ??? Service Worker ??? */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
