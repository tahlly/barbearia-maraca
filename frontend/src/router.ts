type RouteRender = (container: HTMLElement) => () => void;

interface Route {
  path: string;
  render: RouteRender;
}

const routes: Route[] = [];
const anchors: string[] = [];

let currentCleanup: (() => void) | null = null;
let appContainer: HTMLElement | null = null;
let pendingAnchorId: string | null = null;
let currentRoute = "/";

export function registerRoute(path: string, render: RouteRender): void {
  routes.push({ path, render });
}

export function registerAnchor(id: string): void {
  if (!anchors.includes(id)) anchors.push(id);
}

export function navigateTo(hash: string): void {
  window.location.hash = hash;
}

function scrollToAnchor(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const headerH = document.querySelector<HTMLElement>(".header")?.offsetHeight ?? 0;
  const top = el.getBoundingClientRect().top + window.scrollY - headerH;
  window.scrollTo({ top, behavior: "smooth" });
}

function renderHome(): void {
  if (!appContainer) return;
  currentCleanup?.();
  currentCleanup = null;
  const fallback = routes.find((r) => r.path === "/");
  if (fallback) {
    appContainer.classList.remove("view-enter");
    void appContainer.offsetWidth;
    appContainer.classList.add("view-enter");
    currentCleanup = fallback.render(appContainer);
  }
  currentRoute = "/";
}

function handleRoute(): void {
  if (!appContainer) return;

  const hash = window.location.hash.slice(1) || "/";
  const route = routes.find((r) => r.path === hash);
  const anchorId = hash.startsWith("/") ? hash.slice(1) : hash;

  if (route) {
    currentCleanup?.();
    currentCleanup = null;
    appContainer.classList.remove("view-enter");
    void appContainer.offsetWidth;
    appContainer.classList.add("view-enter");
    currentCleanup = route.render(appContainer);
    currentRoute = hash;
  } else if (anchors.includes(anchorId)) {
    pendingAnchorId = anchorId;
    const homeRendered = currentRoute === "/";
    if (!homeRendered) renderHome();
  } else {
    currentCleanup?.();
    currentCleanup = null;
    const fallback = routes.find((r) => r.path === "/");
    if (fallback) {
      currentCleanup = fallback.render(appContainer!);
    }
    currentRoute = "/";
  }

  if (pendingAnchorId) {
    scrollToAnchor(pendingAnchorId);
    pendingAnchorId = null;
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

export function initRouter(container: HTMLElement): void {
  appContainer = container;
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}

export function destroyRouter(): void {
  window.removeEventListener("hashchange", handleRoute);
  currentCleanup?.();
  currentCleanup = null;
  appContainer = null;
}
