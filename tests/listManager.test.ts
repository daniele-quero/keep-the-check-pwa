import { describe, it, expect, beforeEach } from "vitest";
import { ListManager } from "../src/listManager";
import type { PriceItem } from "../src/models";

function makeItem(id: number, price: number): PriceItem {
  return { id, product: `Item ${id}`, price };
}

describe("ListManager", () => {
  let lm: ListManager;
  let lastTotal: number;
  let lastCoupons: number;
  let lastAlertShow: boolean;
  let lastAlertRemaining: number;

  beforeEach(() => {
    lm = new ListManager();
    lastTotal = -1;
    lastCoupons = -1;
    lastAlertShow = false;
    lastAlertRemaining = -1;

    lm.onTotalUpdated((total, coupons) => {
      lastTotal = total;
      lastCoupons = coupons;
    });
    lm.onCouponAlert((show, remaining) => {
      lastAlertShow = show;
      lastAlertRemaining = remaining;
    });
  });

  it("starts with zero total", () => {
    expect(lm.total).toBe(0);
    expect(lm.count).toBe(0);
  });

  it("addItem increases total", () => {
    lm.addItem(makeItem(1, 10));
    expect(lm.total).toBe(10);
    expect(lm.count).toBe(1);
    expect(lastTotal).toBe(10);
  });

  it("addItem accumulates total", () => {
    lm.addItem(makeItem(1, 10));
    lm.addItem(makeItem(2, 5.5));
    expect(lm.total).toBeCloseTo(15.5);
    expect(lm.count).toBe(2);
  });

  it("removeItem decreases total", () => {
    lm.addItem(makeItem(1, 10));
    lm.addItem(makeItem(2, 5));
    lm.removeItem(1);
    expect(lm.total).toBeCloseTo(5);
    expect(lm.count).toBe(1);
  });

  it("removeItem with non-existent id does nothing", () => {
    lm.addItem(makeItem(1, 10));
    lm.removeItem(999);
    expect(lm.total).toBe(10);
    expect(lm.count).toBe(1);
  });

  it("coupons are 0 when useCoupons is false", () => {
    lm.addItem(makeItem(1, 100));
    expect(lastCoupons).toBe(0);
  });

  it("alert is false when useCoupons is false", () => {
    lm.addItem(makeItem(1, 100));
    expect(lastAlertShow).toBe(false);
  });
});

describe("ListManager with coupons", () => {
  let lm: ListManager;
  let lastCoupons: number;
  let lastAlertShow: boolean;
  let lastAlertRemaining: number;

  beforeEach(async () => {
    // Dynamically import config so we can set it before ListManager uses it
    const { config } = await import("../src/config");
    config.save({ useCoupons: true, couponValue: 10, couponAlertThreshold: 0.2 });

    lm = new ListManager();
    lastCoupons = 0;
    lastAlertShow = false;
    lastAlertRemaining = 0;

    lm.onTotalUpdated((_total, coupons) => { lastCoupons = coupons; });
    lm.onCouponAlert((show, remaining) => {
      lastAlertShow = show;
      lastAlertRemaining = remaining;
    });
  });

  it("calculates coupons correctly", () => {
    lm.addItem(makeItem(1, 25));
    expect(lastCoupons).toBe(2);
  });

  it("alert shows when close to next coupon", () => {
    // total = 28.5 ? next = 30, remaining = 1.5, limit = 2 ? show
    lm.addItem(makeItem(1, 28.5));
    expect(lastAlertShow).toBe(true);
    expect(lastAlertRemaining).toBeCloseTo(1.5);
  });

  it("alert hides when far from next coupon", () => {
    // total = 25 ? next = 30, remaining = 5, limit = 2 ? no show
    lm.addItem(makeItem(1, 25));
    expect(lastAlertShow).toBe(false);
  });

  it("alert hides when exactly on a multiple", () => {
    // total = 30 ? next = 40, remaining = 10, limit = 2 ? no show
    lm.addItem(makeItem(1, 30));
    expect(lastAlertShow).toBe(false);
  });

  it("alert toggles when item is removed", () => {
    lm.addItem(makeItem(1, 28.5));
    expect(lastAlertShow).toBe(true);

    lm.addItem(makeItem(2, 0.5));
    // total = 29, remaining = 1, limit = 2 ? show
    expect(lastAlertShow).toBe(true);

    lm.removeItem(2);
    // total = 28.5, remaining = 1.5 ? still show
    expect(lastAlertShow).toBe(true);

    lm.removeItem(1);
    // total = 0 ? no show
    expect(lastAlertShow).toBe(false);
  });
});
