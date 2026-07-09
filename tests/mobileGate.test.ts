import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  DESKTOP_BLOCKER_ID,
  DESKTOP_NOTICE_DEFAULT_MESSAGE,
  isMobileDevice,
  showDesktopNotice,
} from "../src/mobileGate";

const originalMatchMedia = window.matchMedia;
const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;
const originalUserAgent = navigator.userAgent;
const originalMaxTouchPoints = navigator.maxTouchPoints;

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
}

function setMaxTouchPoints(maxTouchPoints: number): void {
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
}

function setMatchMediaResult(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  history.replaceState({}, "", "/");
  setUserAgent(originalUserAgent);
  setMaxTouchPoints(0);
  setViewport(1440, 900);
  setMatchMediaResult(false);
});

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
  setViewport(originalInnerWidth, originalInnerHeight);
  setUserAgent(originalUserAgent);
  setMaxTouchPoints(originalMaxTouchPoints);
  history.replaceState({}, "", "/");
});

describe("isMobileDevice", () => {
  it("returns true for iPhone user agent", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
    );

    expect(isMobileDevice()).toBe(true);
  });

  it("returns true for iPad desktop-class user agent with touch points", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"
    );
    setMaxTouchPoints(5);

    expect(isMobileDevice()).toBe(true);
  });

  it("returns true from fallback when touch + coarse pointer + tablet viewport are present", () => {
    setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36");
    setMaxTouchPoints(5);
    setMatchMediaResult(true);
    setViewport(1024, 768);

    expect(isMobileDevice()).toBe(true);
  });

  it("returns false for desktop user agent without touch", () => {
    setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36");
    setMaxTouchPoints(0);
    setMatchMediaResult(false);
    setViewport(1920, 1080);

    expect(isMobileDevice()).toBe(false);
  });

  it("honors forceMobile query override", () => {
    history.replaceState({}, "", "/?forceMobile=1");
    setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    setMaxTouchPoints(0);
    setMatchMediaResult(false);

    expect(isMobileDevice()).toBe(true);
  });
});

describe("showDesktopNotice", () => {
  it("adds the desktop blocker and hides app root", () => {
    document.body.innerHTML = '<div id="app"></div>';

    showDesktopNotice();

    const blocker = document.getElementById(DESKTOP_BLOCKER_ID);
    const app = document.getElementById("app");

    expect(blocker).not.toBeNull();
    expect(blocker?.textContent).toContain(DESKTOP_NOTICE_DEFAULT_MESSAGE);
    expect(app?.classList.contains("app-hidden")).toBe(true);
    expect(app?.getAttribute("aria-hidden")).toBe("true");
    expect(document.body.classList.contains("desktop-blocked")).toBe(true);
  });

  it("does not duplicate blocker when called multiple times", () => {
    document.body.innerHTML = '<div id="app"></div>';

    showDesktopNotice("Desktop message");
    showDesktopNotice("Another message");

    expect(document.querySelectorAll(`#${DESKTOP_BLOCKER_ID}`).length).toBe(1);
  });
});
