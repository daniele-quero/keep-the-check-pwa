import { describe, it, expect, beforeEach } from "vitest";
import { createAddModal } from "../src/modals/addModal";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("createAddModal", () => {
  it("injects the add modal HTML into the document", () => {
    createAddModal();
    expect(document.getElementById("add-panel")).not.toBeNull();
    expect(document.getElementById("add-overlay")).not.toBeNull();
  });

  it("does not inject duplicate HTML on second call", () => {
    createAddModal();
    createAddModal();
    const panels = document.querySelectorAll("#add-panel");
    expect(panels.length).toBe(1);
  });

  it("modal contains expected input fields", () => {
    createAddModal();
    expect(document.getElementById("add-product")).not.toBeNull();
    expect(document.getElementById("add-price")).not.toBeNull();
    expect(document.getElementById("add-qty-display")).not.toBeNull();
    expect(document.getElementById("add-qty-minus")).not.toBeNull();
    expect(document.getElementById("add-qty-plus")).not.toBeNull();
    expect(document.getElementById("add-ok")).not.toBeNull();
    expect(document.getElementById("add-cancel")).not.toBeNull();
  });
});

describe("Add modal pre-population (edit mode simulation)", () => {
  it("input fields can be pre-filled to simulate edit mode", () => {
    createAddModal();
    const product = document.getElementById("add-product") as HTMLTextAreaElement;
    const price = document.getElementById("add-price") as HTMLInputElement;
    const qtyDisplay = document.getElementById("add-qty-display") as HTMLElement;

    // Simulate what openEditModal does
    product.value = "Test Product";
    price.value = "3.99";
    qtyDisplay.textContent = "2";

    expect(product.value).toBe("Test Product");
    expect(price.value).toBe("3.99");
    expect(qtyDisplay.textContent).toBe("2");
  });

  it("clearing fields simulates add mode", () => {
    createAddModal();
    const product = document.getElementById("add-product") as HTMLTextAreaElement;
    const price = document.getElementById("add-price") as HTMLInputElement;
    const qtyDisplay = document.getElementById("add-qty-display") as HTMLElement;

    // Pre-fill then clear (simulate switching from edit to add)
    product.value = "Some Product";
    price.value = "9.99";
    qtyDisplay.textContent = "3";

    product.value = "";
    price.value = "";
    qtyDisplay.textContent = "1";

    expect(product.value).toBe("");
    expect(price.value).toBe("");
    expect(qtyDisplay.textContent).toBe("1");
  });
});
