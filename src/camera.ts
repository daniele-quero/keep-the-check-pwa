export class CameraService {
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  get isActive(): boolean {
    return this.stream !== null && this.stream.active;
  }

  capture(): string | null {
    if (!this.isActive) return null;

    const canvas = document.createElement("canvas");
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(this.video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
  }

  captureCropped(cropRatio: number): string | null {
    if (!this.isActive) return null;

    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    const displayW = this.video.clientWidth;
    const displayH = this.video.clientHeight;

    // Compute visible source rect accounting for object-fit: cover
    const videoAR = vw / vh;
    const displayAR = displayW / displayH;

    let srcX: number, srcY: number, srcW: number, srcH: number;

    if (videoAR > displayAR) {
      // Video is wider than container — sides are cropped
      srcH = vh;
      srcW = vh * displayAR;
      srcX = (vw - srcW) / 2;
      srcY = 0;
    } else {
      // Video is taller than container — top/bottom are cropped
      srcW = vw;
      srcH = vw / displayAR;
      srcX = 0;
      srcY = (vh - srcH) / 2;
    }

    // Apply the slider crop on top of the visible area
    const cropAmount = srcH * cropRatio * 0.75;
    const finalX = Math.round(srcX);
    const finalY = Math.round(srcY + cropAmount / 2);
    const finalW = Math.round(srcW);
    const finalH = Math.round(srcH - cropAmount);

    const canvas = document.createElement("canvas");
    canvas.width = finalW;
    canvas.height = finalH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(this.video, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH);
    return canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
  }
}
