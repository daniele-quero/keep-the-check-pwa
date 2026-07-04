// Simple YAML import/export for config
import { CurrencyCode } from "./models";
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
  if (typeof data.requireManualConfirm === "string") {
    uiRefs.chkRequireManualConfirm.checked = data.requireManualConfirm === "true";
  }
}

export function exportConfigYaml(cfg: any): string {
  return [
    `currency: ${cfg.currency}`,
    `useCoupons: ${cfg.useCoupons}`,
    `couponValue: ${cfg.couponValue.toFixed(2)}`,
    `couponAlertThreshold: ${cfg.couponAlertThreshold}`,
    `requireManualConfirm: ${cfg.requireManualConfirm ?? true}`,
  ].join("\n") + "\n";
}
