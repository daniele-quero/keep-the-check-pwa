import { PriceItem } from "./models";
import { config } from "./config";

type TotalListener = (total: number, coupons: number) => void;
type AlertListener = (show: boolean, remaining: number) => void;

export class ListManager {
  private items = new Map<number, PriceItem>();
  private _total = 0;

  private totalListeners: TotalListener[] = [];
  private alertListeners: AlertListener[] = [];

  get total(): number { return this._total; }
  get count(): number { return this.items.size; }

  onTotalUpdated(fn: TotalListener): void { this.totalListeners.push(fn); }
  onCouponAlert(fn: AlertListener): void { this.alertListeners.push(fn); }

  addItem(item: PriceItem): void {
    this.items.set(item.id, item);
    this._total += item.price * item.quantity;
    this.notify();
  }

  removeItem(id: number): void {
    const item = this.items.get(id);
    if (!item) return;
    this.items.delete(id);
    this._total -= item.price * item.quantity;
    this.notify();
  }

  changeQuantity(id: number, delta: number): void {
    const item = this.items.get(id);
    if (!item) return;
    const newQty = Math.max(1, item.quantity + delta);
    const diff = (newQty - item.quantity) * item.price;
    item.quantity = newQty;
    this._total += diff;
    this.notify();
  }

  updateItem(id: number, product: string, price: number, quantity: number): void {
    const item = this.items.get(id);
    if (!item) return;
    this._total -= item.price * item.quantity;
    item.product = product;
    item.price = price;
    item.quantity = quantity;
    this._total += price * quantity;
    this.notify();
  }

  recalculate(): void {
    this.notify();
  }

  notify(): void {
    const cfg = config.current;
    let coupons = 0;
    let showAlert = false;
    let remaining = 0;

    if (cfg.useCoupons && cfg.couponValue > 0) {
      coupons = Math.floor(this._total / cfg.couponValue);

      if (this._total > 0) {
        const next = (coupons + 1) * cfg.couponValue;
        remaining = next - this._total;
        const limit = cfg.couponValue * cfg.couponAlertThreshold;
        showAlert = remaining >= 0 && remaining <= limit;
      }
    }

    this.totalListeners.forEach((fn) => fn(this._total, coupons));
    this.alertListeners.forEach((fn) => fn(showAlert, remaining));
  }
}

export const listManager = new ListManager();
