import { describe, it, expect } from "vitest";
import { createPriceItem, generateId } from "../src/models";

describe("models", () => {
  it("generateId returns incrementing ids", () => {
    const a = generateId();
    const b = generateId();
    expect(b).toBe(a + 1);
  });

  it("createPriceItem creates item with correct fields", () => {
    const item = createPriceItem("Apple", 1.5);
    expect(item.product).toBe("Apple");
    expect(item.price).toBe(1.5);
    expect(item.quantity).toBe(1);
    expect(item.id).toBeGreaterThan(0);
  });

  it("createPriceItem generates unique ids", () => {
    const a = createPriceItem("A", 1);
    const b = createPriceItem("B", 2);
    expect(a.id).not.toBe(b.id);
  });
});
