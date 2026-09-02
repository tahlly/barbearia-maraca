import { icon } from "./icons.js";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openOverlays: HTMLElement[] = [];
let lastFocused: HTMLElement | null = null;

function lockScroll(): void {
  document.body.classList.add("has-open-modal");
}

function unlockScroll(): void {
  if (openOverlays.length === 0) {
    document.body.classList.remove("has-open-modal");
  }
}

function focusFirst(overlay: HTMLElement): void {
  const target = overlay.querySelector<HTMLElement>(FOCUSABLE);
  (target ?? overlay).focus({ preventScroll: true });
}

function trapTab(overlay: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== "Tab") return;
  const focusable = Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null,
  );
  if (focusable.length === 0) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function openModal(overlay: HTMLElement): void {
  if (openOverlays.includes(overlay)) return;
  lastFocused = document.activeElement as HTMLElement | null;
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  openOverlays.push(overlay);
  lockScroll();
  window.setTimeout(() => focusFirst(overlay), 60);
}

export function closeModal(overlay: HTMLElement): void {
  if (!openOverlays.includes(overlay)) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  openOverlays = openOverlays.filter((el) => el !== overlay);
  unlockScroll();
  lastFocused?.focus({ preventScroll: true });
}

export function closeTopModal(): void {
  const top = openOverlays[openOverlays.length - 1];
  if (top) closeModal(top);
}

export function isAnyModalOpen(): boolean {
  return openOverlays.length > 0;
}

document.addEventListener("keydown", (event: KeyboardEvent) => {
  const top = openOverlays[openOverlays.length - 1];
  if (!top) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeModal(top);
    top.dispatchEvent(new CustomEvent("modal:close"));
  } else {
    trapTab(top, event);
  }
});

export function initModals(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-open-modal]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const target = document.getElementById(trigger.dataset.openModal ?? "");
      if (target) {
        openModal(target);
        target.dispatchEvent(new CustomEvent("modal:open"));
      }
    });
  });

  root.querySelectorAll<HTMLElement>(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) {
        closeModal(overlay);
        overlay.dispatchEvent(new CustomEvent("modal:close"));
      }
    });
    overlay.querySelectorAll<HTMLElement>("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeModal(overlay);
        overlay.dispatchEvent(new CustomEvent("modal:close"));
      });
    });
  });
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="modal modal--sm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="modal__header">
          <h2 class="modal__title" id="confirm-title"></h2>
          <button type="button" class="modal__close" data-close aria-label="Fechar">${icon("x", 18)}</button>
        </div>
        <div class="modal__body">
          <p class="confirm__message"></p>
          <div class="confirm__actions">
            <button type="button" class="btn btn--ghost" data-cancel></button>
            <button type="button" class="btn ${options.danger ? "btn--danger" : "btn--primary"}" data-confirm></button>
          </div>
        </div>
      </div>`;

    overlay.querySelector(".modal__title")!.textContent = options.title;
    overlay.querySelector(".confirm__message")!.textContent = options.message;
    const confirmBtn = overlay.querySelector<HTMLButtonElement>("[data-confirm]")!;
    confirmBtn.textContent = options.confirmLabel ?? "Confirmar";
    const cancelBtn = overlay.querySelector<HTMLButtonElement>("[data-cancel]")!;
    cancelBtn.textContent = options.cancelLabel ?? "Voltar";

    const finish = (result: boolean) => {
      closeModal(overlay);
      window.setTimeout(() => overlay.remove(), 300);
      resolve(result);
    };

    confirmBtn.addEventListener("click", () => finish(true));
    cancelBtn.addEventListener("click", () => finish(false));
    overlay.querySelector("[data-close]")!.addEventListener("click", () => finish(false));
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) finish(false);
    });

    document.body.appendChild(overlay);
    openModal(overlay);
  });
}
