const PHONE_UA_RE = /android.+mobile|iphone|ipod|windows phone|iemobile|blackberry|opera mini|mobile safari/i;
const TABLET_UA_RE = /ipad|tablet|kindle|silk|playbook|android(?!.*mobile)/i;

export const DESKTOP_BLOCKER_ID = "desktop-blocker";
export const DESKTOP_NOTICE_DEFAULT_MESSAGE =
  "This PWA is only available on mobile devices. Please open it on your phone or tablet.";

function parseBooleanQueryFlag(name: string): boolean | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  if (!params.has(name)) return null;

  const raw = (params.get(name) ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "") return true;
  return true;
}

function hasCoarsePointer(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

function longestViewportEdge(): number {
  if (typeof window === "undefined") return 0;
  return Math.max(
    window.screen?.width ?? 0,
    window.screen?.height ?? 0,
    window.innerWidth ?? 0,
    window.innerHeight ?? 0
  );
}

export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const forcedMobile = parseBooleanQueryFlag("forceMobile");
  if (forcedMobile !== null) return forcedMobile;

  const forcedDesktop = parseBooleanQueryFlag("forceDesktop");
  if (forcedDesktop !== null) return !forcedDesktop;

  const ua = navigator.userAgent.toLowerCase();
  const hasTouch = Number(navigator.maxTouchPoints || 0) > 0;
  const coarsePointer = hasCoarsePointer();
  const viewportEdge = longestViewportEdge();

  if (PHONE_UA_RE.test(ua) || TABLET_UA_RE.test(ua)) return true;

  const isIpadDesktopUa = ua.includes("macintosh") && hasTouch;
  if (isIpadDesktopUa) return true;

  const isLikelyTabletSize = viewportEdge > 0 && viewportEdge <= 1366;
  return hasTouch && coarsePointer && isLikelyTabletSize;
}

export function showDesktopNotice(
  message: string = DESKTOP_NOTICE_DEFAULT_MESSAGE
): void {
  if (typeof document === "undefined") return;

  const existing = document.getElementById(DESKTOP_BLOCKER_ID);
  if (existing) return;

  const appRoot = document.getElementById("app");
  if (appRoot instanceof HTMLElement) {
    appRoot.classList.add("app-hidden");
    appRoot.setAttribute("aria-hidden", "true");
  }

  document.body.classList.add("desktop-blocked");

  const blocker = document.createElement("section");
  blocker.id = DESKTOP_BLOCKER_ID;
  blocker.className = "desktop-blocker";
  blocker.setAttribute("role", "alertdialog");
  blocker.setAttribute("aria-live", "assertive");
  blocker.setAttribute("aria-modal", "true");
  blocker.setAttribute("aria-label", "Mobile device required");
  blocker.tabIndex = -1;

  const card = document.createElement("div");
  card.className = "desktop-blocker__card";

  const title = document.createElement("h1");
  title.className = "desktop-blocker__title";
  title.textContent = "Mobile device required";

  const body = document.createElement("p");
  body.className = "desktop-blocker__text";
  body.textContent = message;

  card.append(title, body);
  blocker.appendChild(card);
  document.body.appendChild(blocker);
  blocker.focus();
}
