import { beforeEach, describe, expect, it } from "vitest";
import { setCameraPreviewState, uiRefs } from "../src/ui";

describe("camera preview state", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="camera-section">
        <video id="preview"></video>
        <img id="captured-preview" alt="" hidden />
      </section>
      <button id="btn-scan"></button>
    `;
  });

  it("shows the captured still frame and disables the shutter while waiting", () => {
    const imageData = "data:image/png;base64,AAAA";

    setCameraPreviewState(true, imageData);

    expect(uiRefs.video.style.display).toBe("none");
    expect(uiRefs.capturedPreview.src).toContain("data:image/png;base64,AAAA");
    expect(uiRefs.btnScan.disabled).toBe(true);

    setCameraPreviewState(false);

    expect(uiRefs.video.style.display).toBe("");
    expect(uiRefs.capturedPreview.hidden).toBe(true);
    expect(uiRefs.btnScan.disabled).toBe(false);
  });
});
