import { describe, it, expect, beforeEach } from "vitest";
import {
  createOptionsModal,
  populateModelDropdown,
  type ProviderOption,
} from "../src/modals/optionsModal";

const SAMPLE_PROVIDERS: ProviderOption[] = [
  { id: "google-gemini", name: "Google Gemini", supportsVision: true, hasKey: true },
  { id: "groq", name: "Groq", supportsVision: true, hasKey: false },
  { id: "mistral", name: "Mistral", supportsVision: true, hasKey: true },
];

describe("optionsModal AI Image Analysis section", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    createOptionsModal();
  });

  it("renders a single model dropdown (select) with a stable id", () => {
    const model = document.getElementById("opt-ai-model");
    expect(model).toBeInstanceOf(HTMLSelectElement);
  });

  it("keeps the require-manual-confirm checkbox", () => {
    const confirm = document.getElementById("opt-require-manual-confirm");
    expect(confirm).toBeInstanceOf(HTMLInputElement);
    expect((confirm as HTMLInputElement).type).toBe("checkbox");
  });

  it("no longer exposes endpoint, api key, timeout or use-proxy inputs", () => {
    expect(document.getElementById("opt-ai-endpoint")).toBeNull();
    expect(document.getElementById("opt-ai-api-key")).toBeNull();
    expect(document.getElementById("opt-ai-timeout")).toBeNull();
    expect(document.getElementById("opt-ai-use-proxy")).toBeNull();
  });

  it("no longer renders any provider fallback cards or key inputs", () => {
    expect(document.querySelector(".ai-provider-section")).toBeNull();
    expect(document.querySelector(".provider-card")).toBeNull();
    for (const id of ["huggingface", "cloudflare", "fireworks", "mistral", "replicate"]) {
      expect(document.getElementById(`opt-provider-${id}-api-key`)).toBeNull();
      expect(document.getElementById(`opt-provider-${id}-endpoint`)).toBeNull();
    }
  });

  it("renders a security note about keys staying on the server", () => {
    const warning = document.querySelector(".opt-warning") as HTMLElement | null;
    expect(warning).not.toBeNull();
    expect(warning!.textContent ?? "").toMatch(/server|proxy|chiave/i);
  });
});

describe("populateModelDropdown", () => {
  let select: HTMLSelectElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    createOptionsModal();
    select = document.getElementById("opt-ai-model") as HTMLSelectElement;
  });

  it("renders one option per vision-capable provider (excludes text-only)", () => {
    populateModelDropdown(select, SAMPLE_PROVIDERS);
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["google-gemini", "groq", "mistral"]);
  });

  it("disables options for providers without a key and marks them (no key)", () => {
    populateModelDropdown(select, SAMPLE_PROVIDERS);
    const groq = Array.from(select.options).find((o) => o.value === "groq")!;
    expect(groq.disabled).toBe(true);
    expect(groq.textContent).toContain("(no key)");

    const gemini = Array.from(select.options).find((o) => o.value === "google-gemini")!;
    expect(gemini.disabled).toBe(false);
    expect(gemini.textContent).toBe("Google Gemini");
  });

  it("preselects the current selection when it has a key", () => {
    populateModelDropdown(select, SAMPLE_PROVIDERS, "mistral");
    expect(select.value).toBe("mistral");
  });

  it("does not select a keyless provider even if it is the current selection", () => {
    populateModelDropdown(select, SAMPLE_PROVIDERS, "groq");
    const groq = Array.from(select.options).find((o) => o.value === "groq")!;
    expect(groq.selected).toBe(false);
  });

  it("replaces previous options on re-populate", () => {
    populateModelDropdown(select, SAMPLE_PROVIDERS);
    populateModelDropdown(select, [
      { id: "openrouter", name: "OpenRouter", supportsVision: true, hasKey: true },
    ]);
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["openrouter"]);
  });
});
