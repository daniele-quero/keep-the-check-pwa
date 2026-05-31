import { describe, it, expect, beforeEach } from "vitest";
import { createOptionsModal } from "../src/modals/optionsModal";

describe("optionsModal AI Image Analysis section", () => {
  const providerIds = [
    "huggingface",
    "cloudflare",
    "fireworks",
    "mistral",
    "replicate",
  ] as const;

  beforeEach(() => {
    document.body.innerHTML = "";
    createOptionsModal();
  });

  it("renders all AI image inputs with stable ids", () => {
    expect(document.getElementById("opt-ai-endpoint")).toBeInstanceOf(HTMLInputElement);
    expect(document.getElementById("opt-ai-model")).toBeInstanceOf(HTMLInputElement);
    expect(document.getElementById("opt-ai-api-key")).toBeInstanceOf(HTMLInputElement);
    expect(document.getElementById("opt-ai-timeout")).toBeInstanceOf(HTMLInputElement);
    expect(document.getElementById("opt-ai-use-proxy")).toBeInstanceOf(HTMLInputElement);
    expect(document.getElementById("opt-require-manual-confirm")).toBeInstanceOf(HTMLInputElement);
  });

  it("uses the correct input types and constraints", () => {
    const endpoint = document.getElementById("opt-ai-endpoint") as HTMLInputElement;
    const model = document.getElementById("opt-ai-model") as HTMLInputElement;
    const apiKey = document.getElementById("opt-ai-api-key") as HTMLInputElement;
    const timeout = document.getElementById("opt-ai-timeout") as HTMLInputElement;
    const useProxy = document.getElementById("opt-ai-use-proxy") as HTMLInputElement;
    const requireConfirm = document.getElementById("opt-require-manual-confirm") as HTMLInputElement;

    expect(endpoint.type).toBe("text");
    expect(model.type).toBe("text");
    expect(apiKey.type).toBe("password");
    expect(apiKey.getAttribute("autocomplete")).toBe("off");
    expect(timeout.type).toBe("number");
    expect(timeout.min).toBe("1000");
    expect(timeout.step).toBe("500");
    expect(useProxy.type).toBe("checkbox");
    expect(requireConfirm.type).toBe("checkbox");
  });

  it("tags every AI image input with the matching data-config-key", () => {
    const pairs: Array<[string, string]> = [
      ["opt-ai-endpoint", "aiEndpoint"],
      ["opt-ai-model", "aiModel"],
      ["opt-ai-api-key", "aiApiKey"],
      ["opt-ai-timeout", "aiTimeoutMs"],
      ["opt-ai-use-proxy", "aiUseProxy"],
      ["opt-require-manual-confirm", "requireManualConfirm"],
    ];
    for (const [id, key] of pairs) {
      const el = document.getElementById(id) as HTMLElement;
      expect(el.dataset.configKey).toBe(key);
    }
  });

  it("renders an inline security warning about not committing API keys", () => {
    const warning = document.querySelector(".opt-warning") as HTMLElement | null;
    expect(warning).not.toBeNull();
    expect(warning!.textContent ?? "").toMatch(/proxy|repository|chiave/i);
  });

  it("renders provider fallback controls for all configured providers", () => {
    for (const id of providerIds) {
      expect(document.getElementById(`opt-provider-${id}-enabled`)).toBeInstanceOf(
        HTMLInputElement
      );
      expect(document.getElementById(`opt-provider-${id}-use-proxy`)).toBeInstanceOf(
        HTMLInputElement
      );
      expect(document.getElementById(`opt-provider-${id}-priority`)).toBeInstanceOf(
        HTMLInputElement
      );
      expect(document.getElementById(`opt-provider-${id}-timeout`)).toBeInstanceOf(
        HTMLInputElement
      );
      expect(document.getElementById(`opt-provider-${id}-endpoint`)).toBeInstanceOf(
        HTMLInputElement
      );
      expect(document.getElementById(`opt-provider-${id}-model`)).toBeInstanceOf(
        HTMLInputElement
      );
      expect(document.getElementById(`opt-provider-${id}-api-key`)).toBeInstanceOf(
        HTMLInputElement
      );
    }
  });

  it("uses numeric constraints and hidden-api-key fields for providers", () => {
    for (const id of providerIds) {
      const priority = document.getElementById(
        `opt-provider-${id}-priority`
      ) as HTMLInputElement;
      const timeout = document.getElementById(
        `opt-provider-${id}-timeout`
      ) as HTMLInputElement;
      const apiKey = document.getElementById(
        `opt-provider-${id}-api-key`
      ) as HTMLInputElement;

      expect(priority.type).toBe("number");
      expect(priority.min).toBe("1");
      expect(timeout.type).toBe("number");
      expect(timeout.min).toBe("1000");
      expect(apiKey.type).toBe("password");
      expect(apiKey.getAttribute("autocomplete")).toBe("off");
    }
  });
});
