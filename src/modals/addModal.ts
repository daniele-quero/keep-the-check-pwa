import { Modal } from "../modal";
import html from "./addModal.html?raw";

export function createAddModal(): Modal {
  if (!document.getElementById("add-panel")) {
    document.body.insertAdjacentHTML("beforeend", html);
  }
  return new Modal("add-panel", "add-overlay");
}
