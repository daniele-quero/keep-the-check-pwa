import { Modal } from "../modal";
import html from "./tutorialModal.html?raw";
import { type Lang, renderTutorial } from "../tutorial";

const LANG_KEY = "tutorialLang";

export function createTutorialModal(): Modal {
  if (!document.getElementById("tutorial-panel")) {
    document.body.insertAdjacentHTML("beforeend", html);
  }
  return new Modal("tutorial-panel", "tutorial-overlay");
}

export function initTutorialLang(): void {
  const saved = (localStorage.getItem(LANG_KEY) as Lang) ?? "it";
  applyLang(saved);

  document.getElementById("btn-lang-it")?.addEventListener("click", () => {
    localStorage.setItem(LANG_KEY, "it");
    applyLang("it");
  });

  document.getElementById("btn-lang-en")?.addEventListener("click", () => {
    localStorage.setItem(LANG_KEY, "en");
    applyLang("en");
  });
}

function applyLang(lang: Lang): void {
  const content = document.getElementById("tutorial-content");
  if (content) content.innerHTML = renderTutorial(lang);

  document.getElementById("btn-lang-it")?.classList.toggle("lang-active", lang === "it");
  document.getElementById("btn-lang-en")?.classList.toggle("lang-active", lang === "en");
}
