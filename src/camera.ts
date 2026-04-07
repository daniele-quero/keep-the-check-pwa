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
    const cropH = Math.round(vh * (1 - cropRatio * 0.75));
    const offsetY = Math.round((vh - cropH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = vw;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(this.video, 0, offsetY, vw, cropH, 0, 0, vw, cropH);
    return canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
  }
}
