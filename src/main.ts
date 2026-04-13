import "./style.css";
import { CameraService } from "./camera";
import { config } from "./config";
import { listManager } from "./listManager";
import { recognizeOcr, parseWithGemini, parseWithGroq } from "./api";
import { createOptionsModal, initOptionTooltips } from "./modals/optionsModal";
import { createAddModal } from "./modals/addModal";
import { createPriceItem, generateId, AiProvider, OcrProvider, CurrencyCode } from "./models";
import type { PriceItem, PriceResult } from "./models";
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

/* ??? Populate dropdowns ??? */

function populateOptions(): void {
  const cfg = config.current;
  populateSelect(uiRefs.selAi, Object.values(AiProvider), cfg.aiProvider);
  populateSelect(uiRefs.selCurrency, Object.values(CurrencyCode), cfg.currency);
  uiRefs.inputOcrKey.value = cfg.ocrApiKeys[OcrProvider.OcrSpace] ?? "";
  uiRefs.inputAiKey.value = cfg.aiApiKeys[cfg.aiProvider] ?? "";
  uiRefs.selOcrEngine.value = cfg.ocrEngine;
  uiRefs.chkOcrTable.checked = cfg.ocrIsTable;
  uiRefs.chkUseOcr.checked = cfg.useOcr;
  uiRefs.chkCoupons.checked = cfg.useCoupons;
  uiRefs.inputCouponVal.value = cfg.couponValue.toFixed(2);
  uiRefs.sliderThreshold.value = String(cfg.couponAlertThreshold);
  updateThresholdLabel(cfg.couponAlertThreshold, uiRefs.thresholdLabel);
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

uiRefs.selAi.addEventListener("change", () => {
  uiRefs.inputAiKey.value = config.current.aiApiKeys[uiRefs.selAi.value] ?? "";
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

// ...existing code...

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
    try {
      return fallback === AiProvider.Groq
        ? await parseWithGroq(ocrText, fallbackKey)
        : await parseWithGemini(ocrText, fallbackKey);
    } catch (fallbackErr) {
      const pMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      const fMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(`${primary} failed: ${pMsg} | ${fallback} fallback failed: ${fMsg}`);
    }
  }
}

/* ??? Scan ??? */

let scanning = false;

async function doScan(): Promise<void> {
  if (scanning) return;
  scanning = true;

  uiRefs.spinner.classList.add("active");
  uiRefs.btnScan.disabled = true;

  try {
    const cropVal = parseFloat(uiRefs.cropSlider.value);
    const base64 = camera.captureCropped(cropVal);
    if (!base64) throw new Error("Camera capture failed");

    const ocrText = await recognizeOcr(base64, config.getOcrApiKey(), "ita", {
      engine: config.current.ocrEngine,
      isTable: config.current.ocrIsTable,
    });

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
    uiRefs.spinner.classList.remove("active");
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
  const updatedAiKeys = { ...config.current.aiApiKeys, [uiRefs.selAi.value]: uiRefs.inputAiKey.value.trim() };
  const updatedOcrKeys = { ...config.current.ocrApiKeys, [OcrProvider.OcrSpace]: uiRefs.inputOcrKey.value.trim() };
  config.save({
    aiProvider: uiRefs.selAi.value as AiProvider,
    ocrProvider: OcrProvider.OcrSpace,
    currency: uiRefs.selCurrency.value as CurrencyCode,
    ocrApiKeys: updatedOcrKeys,
    aiApiKeys: updatedAiKeys,
    ocrEngine: uiRefs.selOcrEngine.value,
    ocrIsTable: uiRefs.chkOcrTable.checked,
    useOcr: uiRefs.chkUseOcr.checked,
    useCoupons: uiRefs.chkCoupons.checked,
    couponValue: parseFloat(uiRefs.inputCouponVal.value) || 0,
    couponAlertThreshold: parseFloat(uiRefs.sliderThreshold.value) || 0.2,
  });
  optionsModal.close();
});

uiRefs.btnOptCancel.addEventListener("click", () => {
  optionsModal.close();
});

/* ??? Add modal ??? */
let addQty = 1;

uiRefs.btnAdd.addEventListener("click", () => {
  uiRefs.inputProduct.value = "";
  uiRefs.inputPrice.value = "";
  addQty = 1;
  uiRefs.addQtyDisplay.textContent = "1";
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

  const item = createPriceItem(product, price);
  item.quantity = addQty;
  addResultItem(item);
  addModal.close();
});

uiRefs.btnAddCancel.addEventListener("click", () => {
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
