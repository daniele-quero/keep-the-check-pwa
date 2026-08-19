import { afterEach, describe, expect, it, vi } from "vitest";
import { CameraService, fitWithinMaxDimension } from "../src/camera";

describe("fitWithinMaxDimension", () => {
  it("keeps dimensions at or below the image-processing limit", () => {
    expect(fitWithinMaxDimension(1920, 1080)).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it("preserves images that already fit the limit", () => {
    expect(fitWithinMaxDimension(960, 720)).toEqual({
      width: 960,
      height: 720,
    });
  });

  it("preserves the aspect ratio for portrait captures", () => {
    expect(fitWithinMaxDimension(1080, 1920)).toEqual({
      width: 720,
      height: 1280,
    });
  });
});

describe("CameraService.captureCropped", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("uses the slider crop rectangle rather than sending the full frame", () => {
    document.body.innerHTML = '<video id="preview"></video>';
    const video = document.getElementById("preview") as HTMLVideoElement;
    Object.defineProperties(video, {
      videoWidth: { value: 1920 },
      videoHeight: { value: 1080 },
      clientWidth: { value: 360 },
      clientHeight: { value: 640 },
    });

    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => "data:image/jpeg;base64,CROPPED");
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName !== "canvas") return originalCreateElement(tagName);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
        toDataURL,
      } as unknown as HTMLCanvasElement;
    });

    const camera = new CameraService(video);
    (camera as unknown as { stream: MediaStream }).stream = { active: true } as MediaStream;

    expect(camera.captureCropped(0.5)).toBe("CROPPED");
    expect(drawImage).toHaveBeenCalledWith(
      video,
      656,
      203,
      608,
      675,
      0,
      0,
      608,
      675
    );
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.82);
  });
});
