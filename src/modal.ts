export class Modal {
  private panel: HTMLElement;
  private overlay: HTMLElement;
  private isOpen = false;
  private duration = 500;

  constructor(panelId: string, overlayId: string) {
    this.panel = document.getElementById(panelId)!;
    this.overlay = document.getElementById(overlayId)!;

    this.overlay.addEventListener("click", () => this.close());
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.overlay.classList.add("visible");
    this.panel.classList.add("open");
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.panel.classList.remove("open");
    this.overlay.classList.remove("visible");
  }

  get opened(): boolean {
    return this.isOpen;
  }
}
