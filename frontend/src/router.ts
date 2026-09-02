type Route = {
  path: string;
  title: string;
  render: () => string;
  afterMount?: () => void;
};

type RouteGuard = (path: string) => boolean;

const routes: Route[] = [];
let currentCleanup: (() => void) | null = null;
let guard: RouteGuard | null = null;

export function addRoute(path: string, title: string, render: () => string, afterMount?: () => void): void {
  routes.push({ path, title, render, afterMount });
}

export function setGuard(fn: RouteGuard): void {
  guard = fn;
}

function matchRoute(path: string): Route | undefined {
  return routes.find((r) => r.path === path);
}

function getLink(path: string, label: string): string {
  return `<a href="${path}" data-nav>${label}</a>`;
}

export function updateNavLinks(links: { path: string; label: string }[]): void {
  const container = document.getElementById('nav-links');
  if (!container) return;
  container.innerHTML = links.map((l) => getLink(l.path, l.label)).join('');
}

function renderApp(route: Route): void {
  const app = document.getElementById('app');
  if (!app) return;

  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  document.title = `${route.title} | Barbearia Maraca`;
  app.innerHTML = `<div class="page">${route.render()}</div>`;

  if (route.afterMount) {
    route.afterMount();
  }

  document.querySelectorAll('#nav-links a').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === route.path);
  });
}

function navigate(path: string): void {
  if (guard && !guard(path)) return;

  const route = matchRoute(path);
  if (!route) {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = '<div class="page"><h1>404</h1><p>Pagina nao encontrada.</p></div>';
    }
    return;
  }

  history.pushState(null, '', path);
  renderApp(route);
}

export function initRouter(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' && target.hasAttribute('data-nav')) {
      e.preventDefault();
      const href = target.getAttribute('href');
      if (href) navigate(href);
    }
  });

  window.addEventListener('popstate', () => {
    const route = matchRoute(location.pathname);
    if (route) renderApp(route);
  });

  const route = matchRoute(location.pathname);
  if (route) {
    renderApp(route);
  } else {
    navigate('/');
  }
}
