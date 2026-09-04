import { $ } from "../ui/dom.js";

export function initNavbar(): () => void {
  const toggle = $<HTMLButtonElement>("#nav-toggle");
  const nav = $("#nav");
  if (!toggle || !nav) return () => {};

  let backdrop = document.querySelector<HTMLElement>(".nav-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    document.body.appendChild(backdrop);
  }

  const closeMenu = (): void => {
    nav.classList.remove("is-open");
    toggle.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("has-nav-open");
  };

  const handleToggle = (): void => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.classList.toggle("is-open", isOpen);
    backdrop.classList.toggle("is-visible", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("has-nav-open", isOpen);
  };

  const handleResize = (): void => {
    if (window.innerWidth > 768) closeMenu();
  };

  toggle.addEventListener("click", handleToggle);
  backdrop.addEventListener("click", closeMenu);

  const linkCleanups: Array<() => void> = [];
  nav.querySelectorAll("a").forEach((link) => {
    const handler = closeMenu;
    link.addEventListener("click", handler);
    linkCleanups.push(() => link.removeEventListener("click", handler));
  });

  window.addEventListener("resize", handleResize);

  return () => {
    toggle.removeEventListener("click", handleToggle);
    backdrop.removeEventListener("click", closeMenu);
    window.removeEventListener("resize", handleResize);
    linkCleanups.forEach((fn) => fn());
    backdrop.remove();
  };
}
