import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  isMobileDeviceMock,
  showDesktopNoticeMock,
  cameraCtorMock,
  cameraStartMock,
} = vi.hoisted(() => ({
  isMobileDeviceMock: vi.fn(),
  showDesktopNoticeMock: vi.fn(),
  cameraCtorMock: vi.fn(),
  cameraStartMock: vi.fn(),
}));

vi.mock("../src/mobileGate", () => ({
  isMobileDevice: isMobileDeviceMock,
  showDesktopNotice: showDesktopNoticeMock,
}));

vi.mock("../src/camera", () => ({
  CameraService: class MockCameraService {
    constructor() {
      cameraCtorMock();
    }

    start() {
      cameraStartMock();
      return Promise.resolve();
    }

    captureCropped() {
      return "";
    }
  },
}));

describe("main bootstrap gate", () => {
  beforeEach(() => {
    vi.resetModules();
    isMobileDeviceMock.mockReset();
    showDesktopNoticeMock.mockReset();
    cameraCtorMock.mockReset();
    cameraStartMock.mockReset();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it("shows desktop notice and skips camera initialization on desktop", async () => {
    isMobileDeviceMock.mockReturnValue(false);

    await import("../src/main.ts");

    expect(showDesktopNoticeMock).toHaveBeenCalledTimes(1);
    expect(cameraCtorMock).not.toHaveBeenCalled();
    expect(cameraStartMock).not.toHaveBeenCalled();
  });
});
