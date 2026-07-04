import { Modal } from "../modal";
import html from "./optionsModal.html?raw";
import { type Lang, getOptionTooltips } from "../tutorial";

const TOOLTIP_MS = 3000;
const LANG_KEY = "tutorialLang";
let activeTooltip: HTMLElement | null = null;
let activeTimeout: ReturnType<typeof setTimeout> | null = null;

export function createOptionsModal(): Modal {
  if (!document.getElementById("options-panel")) {
    document.body.insertAdjacentHTML("beforeend", html);
  }
  return new Modal("options-panel", "options-overlay");
}

export interface ProviderOption {
  id: string;
  name: string;
  supportsVision: boolean;
  hasKey: boolean;
}

/**
 * Populate the AI model dropdown from the server-provided provider list.
 * Only vision-capable providers are listed. Providers without a configured
 * server key are rendered as visible-but-disabled options.
 */
export function populateModelDropdown(
  select: HTMLSelectElement,
  providers: ProviderOption[],
  selectedId?: string | null
): void {
  select.innerHTML = "";
  for (const provider of providers) {
    if (!provider.supportsVision) continue;
    const opt = document.createElement("option");
    opt.value = provider.id;
    opt.textContent = provider.hasKey
      ? provider.name
      : `${provider.name} (no key)`;
    opt.disabled = !provider.hasKey;
    if (provider.hasKey && provider.id === selectedId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }
}

export function initOptionTooltips(): void {
  const panel = document.getElementById("options-panel");
  if (!panel) return;
  panel.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest(".opt-tip") as HTMLElement | null;
    if (!target) return;
    const key = target.dataset.tip;
    if (!key) return;
    const lang = (localStorage.getItem(LANG_KEY) as Lang) ?? "it";
    const tips = getOptionTooltips(lang);
    const text = tips[key];
    if (!text) return;
    showTooltip(target, text);
  });
}

function showTooltip(anchor: HTMLElement, text: string): void {
  dismissTooltip();
  const tip = document.createElement("div");
  tip.className = "opt-tooltip";
  tip.textContent = text;
  document.getElementById("options-panel")!.appendChild(tip);

  const anchorRect = anchor.getBoundingClientRect();
  const panelRect = document.getElementById("options-panel")!.getBoundingClientRect();
  tip.style.top = `${anchorRect.bottom - panelRect.top + 4}px`;
  tip.style.left = `${anchorRect.left - panelRect.left}px`;

  requestAnimationFrame(() => tip.classList.add("visible"));
  activeTooltip = tip;
  activeTimeout = setTimeout(dismissTooltip, TOOLTIP_MS);
}

function dismissTooltip(): void {
  if (activeTimeout) { clearTimeout(activeTimeout); activeTimeout = null; }
  if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
}
