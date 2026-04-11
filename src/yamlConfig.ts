// Simple YAML import/export for config
import { AiProvider, OcrProvider, CurrencyCode } from "./models";
import { config } from "./config";
import { updateThresholdLabel } from "./ui";

export function parseSimpleYaml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentMap: Record<string, string> | null = null;
  let currentKey = "";

  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;

    const nested = raw.match(/^(\s{2,})([\w]+):\s*(.+)$/);
    if (nested && currentMap) {
      currentMap[nested[2]] = nested[3].replace(/^\"'|\"'$/g, "");
      continue;
    }

    if (currentMap) {
      result[currentKey] = currentMap;
      currentMap = null;
    }

    const match = raw.match(/^([\w]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    const val = match[2].trim();

    if (val === "") {
      currentMap = {};
      currentKey = key;
    } else {
      result[key] = val.replace(/^\"'|\"'$/g, "");
    }
  }
  if (currentMap) result[currentKey] = currentMap;
  return result;
}

export function applyYamlToModal(data: Record<string, unknown>, uiRefs: any): void {
  if (typeof data.aiProvider === "string" && Object.values(AiProvider).includes(data.aiProvider as AiProvider)) {
    uiRefs.selAi.value = data.aiProvider as string;
    uiRefs.inputAiKey.value = config.current.aiApiKeys[data.aiProvider as string] ?? "";
  }
  if (typeof data.ocrProvider === "string" && Object.values(OcrProvider).includes(data.ocrProvider as OcrProvider)) {
    uiRefs.selOcr.value = data.ocrProvider as string;
    uiRefs.inputOcrKey.value = config.current.ocrApiKeys[data.ocrProvider as string] ?? "";
  }
  if (typeof data.currency === "string" && Object.values(CurrencyCode).includes(data.currency as CurrencyCode)) {
    uiRefs.selCurrency.value = data.currency as string;
  }
  if (typeof data.useCoupons === "string") {
    uiRefs.chkCoupons.checked = data.useCoupons === "true";
  }
  if (typeof data.couponValue === "string") {
    const v = parseFloat(data.couponValue);
    if (!isNaN(v)) uiRefs.inputCouponVal.value = v.toFixed(2);
  }
  if (typeof data.couponAlertThreshold === "string") {
    const v = parseFloat(data.couponAlertThreshold);
    if (!isNaN(v) && v >= 0.05 && v <= 0.30) {
      uiRefs.sliderThreshold.value = String(v);
      updateThresholdLabel(v, uiRefs.thresholdLabel);
    }
  }
  if (typeof data.ocrApiKeys === "object" && data.ocrApiKeys !== null) {
    const keys = data.ocrApiKeys as Record<string, string>;
    const provider = uiRefs.selOcr.value;
    if (keys[provider]) uiRefs.inputOcrKey.value = keys[provider];
  }
  if (typeof data.aiApiKeys === "object" && data.aiApiKeys !== null) {
    const keys = data.aiApiKeys as Record<string, string>;
    const provider = uiRefs.selAi.value;
    if (keys[provider]) uiRefs.inputAiKey.value = keys[provider];
  }
}

export function exportConfigYaml(cfg: any): string {
  const ocrKeys = Object.entries(cfg.ocrApiKeys)
    .map(([k, v]) => `  ${k}: "${v}"`).join("\n");
  const aiKeys = Object.entries(cfg.aiApiKeys)
    .map(([k, v]) => `  ${k}: "${v}"`).join("\n");

  return [
    `currency: ${cfg.currency}`,
    `aiProvider: ${cfg.aiProvider}`,
    `ocrProvider: ${cfg.ocrProvider}`,
    `useCoupons: ${cfg.useCoupons}`,
    `couponValue: ${cfg.couponValue.toFixed(2)}`,
    `couponAlertThreshold: ${cfg.couponAlertThreshold}`,
    `ocrApiKeys:`,
    ocrKeys,
    `aiApiKeys:`,
    aiKeys,
  ].join("\n") + "\n";
}
