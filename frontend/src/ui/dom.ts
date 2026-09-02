export const $ = <T extends HTMLElement = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T | null => root.querySelector<T>(selector);

export const $$ = <T extends HTMLElement = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] => Array.from(root.querySelectorAll<T>(selector));

export function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase();
}

export function setFieldError(input: HTMLInputElement, message: string | null): void {
  const field = input.closest(".field");
  if (!field) return;
  const errorEl = field.querySelector<HTMLElement>(".field__error");
  if (message) {
    field.classList.add("has-error");
    input.setAttribute("aria-invalid", "true");
    if (errorEl) errorEl.textContent = message;
  } else {
    field.classList.remove("has-error");
    input.removeAttribute("aria-invalid");
  }
}

export function clearFormErrors(form: HTMLFormElement): void {
  form.querySelectorAll(".field.has-error").forEach((el) => el.classList.remove("has-error"));
  form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
}
