import { describe, it, expect, beforeEach } from "vitest";
import { createOptionsModal } from "../src/modals/optionsModal";

describe("optionsModal AI Image Analysis section", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    createOptionsModal();
  });

  it("does not render the model selection dropdown anymore", () => {
    const model = document.getElementById("opt-ai-model");
    expect(model).toBeNull();
  });

  it("keeps the require-manual-confirm checkbox", () => {
    const confirm = document.getElementById("opt-require-manual-confirm");
    expect(confirm).toBeInstanceOf(HTMLInputElement);
    expect((confirm as HTMLInputElement).type).toBe("checkbox");
  });

  it("no longer exposes legacy provider or endpoint controls", () => {
    expect(document.getElementById("opt-ai-endpoint")).toBeNull();
    expect(document.getElementById("opt-ai-api-key")).toBeNull();
    expect(document.getElementById("opt-ai-timeout")).toBeNull();
    expect(document.getElementById("opt-ai-use-proxy")).toBeNull();
    expect(document.querySelector(".ai-provider-section")).toBeNull();
    expect(document.querySelector(".provider-card")).toBeNull();
  });

  it("does not render the optional security note", () => {
    const warning = document.querySelector(".opt-warning") as HTMLElement | null;
    expect(warning).toBeNull();
  });
});
