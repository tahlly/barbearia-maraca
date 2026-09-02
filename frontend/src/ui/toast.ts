import { icon } from "./icons.js";

type ToastVariant = "success" | "error" | "info";

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: "check-circle",
  error: "error-circle",
  info: "info-circle",
};

function ensureContainer(): HTMLElement {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, variant: ToastVariant = "success"): void {
  const container = ensureContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast--${variant}`;
  toast.innerHTML = `
    <span class="toast__icon">${icon(VARIANT_ICON[variant], 18)}</span>
    <span class="toast__message"></span>`;
  toast.querySelector(".toast__message")!.textContent = message;
  container.appendChild(toast);

  window.requestAnimationFrame(() => toast.classList.add("is-visible"));

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    window.setTimeout(() => toast.remove(), 500);
  }, 3200);
}
