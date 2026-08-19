const OUTPUT_MIME_TYPE = "image/jpeg";
const OUTPUT_QUALITY = 0.82;
const MAX_OUTPUT_DIMENSION = 1280;

export function fitWithinMaxDimension(
  width: number,
  height: number,
  maxDimension = MAX_OUTPUT_DIMENSION
): { width: number; height: number } {
  const longestSide = Math.max(width, height);
  if (longestSide <= maxDimension) return { width, height };

  const scale = maxDimension / longestSide;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

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
    const output = fitWithinMaxDimension(this.video.videoWidth, this.video.videoHeight);
    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(OUTPUT_MIME_TYPE, OUTPUT_QUALITY).split(",")[1];
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

    const output = fitWithinMaxDimension(finalW, finalH);
    const canvas = document.createElement("canvas");
    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(
      this.video,
      finalX,
      finalY,
      finalW,
      finalH,
      0,
      0,
      output.width,
      output.height
    );
    return canvas.toDataURL(OUTPUT_MIME_TYPE, OUTPUT_QUALITY).split(",")[1];
  }
}
