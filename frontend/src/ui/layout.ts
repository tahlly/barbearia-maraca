import { getSession, logout } from "../services/auth.js";
import { $, escapeHtml, initials } from "./dom.js";
import { bindThemeToggles, syncLogoImages } from "../theme.js";
import { icon } from "./icons.js";

export interface PanelLink {
  href: string;
  label: string;
  icon: string;
}

export interface PanelOptions {
  title: string;
  roleLabel: string;
  links: PanelLink[];
}

export interface PanelHandle {
  content: HTMLElement;
  cleanup: () => void;
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    superusuario: "Superusuário",
    admin: "Administrador",
    recepcionista: "Recepcionista",
    profissional: "Profissional",
    cliente: "Cliente",
  };
  return map[role] ?? "Usuário";
}

export function renderPanel(container: HTMLElement, options: PanelOptions): PanelHandle {
  const session = getSession();
  const user = session?.userName ?? "Usuário";
  const initialsText = initials(user);

  const COLLAPSE_KEY = "maraca.panel.collapsed";
  const isCollapsed = localStorage.getItem(COLLAPSE_KEY) === "1";

  document.body.classList.add("panel-mode");
  container.innerHTML = `
    <div class="panel ${isCollapsed ? "is-collapsed" : ""}">
      <aside class="panel__sidebar">
        <div class="panel__brand-row">
          <a href="#/" class="panel__brand" title="Barbearia Maracá">
            <img src="assets/images/logo-maraca.png" alt="Barbearia Maracá" width="34" height="34" data-logo>
            <span>Barbearia Maracá</span>
          </a>
          <button type="button" class="panel__collapse" data-panel-collapse aria-label="${isCollapsed ? "Expandir menu" : "Recolher menu"}" aria-expanded="${isCollapsed ? "false" : "true"}" title="${isCollapsed ? "Expandir menu" : "Recolher menu"}">
            <span class="panel__collapse-icon">${icon(isCollapsed ? "chevrons-right" : "chevrons-left", 20)}</span>
          </button>
        </div>
        <nav class="panel__nav" aria-label="Navegação do painel">
          ${options.links
            .map(
              (link) => `
              <a href="${link.href}" class="panel__link" data-panel-link="${escapeHtml(link.href)}" title="${escapeHtml(link.label)}">
                <span class="panel__link-icon">${icon(link.icon, 18)}</span>
                <span>${escapeHtml(link.label)}</span>
              </a>`,
            )
            .join("")}
        </nav>
        <div class="panel__footer">
          <div class="panel__user" title="${escapeHtml(user)}">
            <span class="avatar avatar--sm">${initialsText}</span>
            <div class="panel__user-meta">
              <strong>${escapeHtml(user)}</strong>
              <small>${escapeHtml(options.roleLabel)}</small>
            </div>
          </div>
          <button type="button" class="panel__logout" data-panel-logout title="Sair">
            ${icon("logout", 18)}<span>Sair</span>
          </button>
        </div>
      </aside>
      <div class="panel__backdrop" data-panel-backdrop></div>
      <div class="panel__main">
        <header class="panel__topbar">
          <div class="panel__topbar-start">
            <button type="button" class="panel__hamburger" data-panel-hamburger aria-label="Abrir menu" aria-expanded="false">
              <span class="panel__hamburger-icon">${icon("menu", 22)}</span>
            </button>
            <h1 class="panel__title">${escapeHtml(options.title)}</h1>
          </div>
          <button type="button" class="theme-toggle" data-theme-toggle aria-label="Alternar para tema claro">
            <i class="bx bx-moon"></i>
          </button>
        </header>
        <div class="panel__content" data-panel-content></div>
      </div>
    </div>
  `;

  const panelRoot = container.querySelector<HTMLElement>(".panel")!;
  const content = $<HTMLElement>("[data-panel-content]", container)!;
  const cleanups: Array<() => void> = [];

  cleanups.push(bindThemeToggles(container));
  syncLogoImages(container);

  const collapseBtn = $<HTMLButtonElement>("[data-panel-collapse]", container);
  if (collapseBtn) {
    const onCollapse = (): void => {
      const collapsed = panelRoot.classList.toggle("is-collapsed");
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
      const label = collapsed ? "Expandir menu" : "Recolher menu";
      collapseBtn.setAttribute("aria-label", label);
      collapseBtn.setAttribute("aria-expanded", String(!collapsed));
      collapseBtn.setAttribute("title", label);
      const iconEl = collapseBtn.querySelector<HTMLElement>(".panel__collapse-icon")!;
      iconEl.innerHTML = icon(collapsed ? "chevrons-right" : "chevrons-left", 20);
    };
    collapseBtn.addEventListener("click", onCollapse);
    cleanups.push(() => collapseBtn.removeEventListener("click", onCollapse));
  }

  const hamburgerBtn = $<HTMLButtonElement>("[data-panel-hamburger]", container);
  const backdrop = $<HTMLElement>("[data-panel-backdrop]", container);

  function setMobileOpen(open: boolean): void {
    panelRoot.classList.toggle("is-mobile-open", open);
    hamburgerBtn?.setAttribute("aria-expanded", String(open));
    hamburgerBtn?.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    const iconEl = hamburgerBtn?.querySelector<HTMLElement>(".panel__hamburger-icon");
    if (iconEl) iconEl.innerHTML = icon(open ? "x" : "menu", 22);
  }

  if (hamburgerBtn) {
    const onHamburger = (): void => {
      const open = panelRoot.classList.contains("is-mobile-open");
      setMobileOpen(!open);
    };
    hamburgerBtn.addEventListener("click", onHamburger);
    cleanups.push(() => hamburgerBtn.removeEventListener("click", onHamburger));
  }

  backdrop?.addEventListener("click", () => setMobileOpen(false));

  const onPanelHashChange = (): void => setMobileOpen(false);
  window.addEventListener("hashchange", onPanelHashChange);
  cleanups.push(() => window.removeEventListener("hashchange", onPanelHashChange));

  const markActive = (): void => {
    const path = window.location.hash;
    container.querySelectorAll<HTMLElement>("[data-panel-link]").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.panelLink === path);
    });
  };
  markActive();
  window.addEventListener("hashchange", markActive);
  cleanups.push(() => window.removeEventListener("hashchange", markActive));

  const logoutBtn = $<HTMLButtonElement>("[data-panel-logout]", container);
  if (logoutBtn) {
    const handler = (): void => {
      logout();
    };
    logoutBtn.addEventListener("click", handler);
    cleanups.push(() => logoutBtn.removeEventListener("click", handler));
  }

  const cleanup = (): void => {
    document.body.classList.remove("panel-mode");
    cleanups.forEach((fn) => fn());
  };

  return { content, cleanup };
}

export function panelRoleLabel(): string {
  const session = getSession();
  return roleLabel(session?.role ?? "");
}

export function configPanelLinks(role: string): PanelLink[] {
  const base = [
    { href: "#/", label: "Início", icon: "grid" },
  ];
  if (role === "admin") {
    return [
      { href: "#/admin", label: "Dashboard", icon: "grid" },
      { href: "#/admin/servicos", label: "Serviços", icon: "scissors" },
      { href: "#/admin/profissionais", label: "Profissionais", icon: "users" },
      { href: "#/admin/agendamentos", label: "Agendamentos", icon: "calendar" },
      { href: "#/", label: "Início", icon: "grid" },
    ];
  }
  if (role === "recepcionista") {
    return [
      { href: "#/recepcionista", label: "Agenda", icon: "calendar" },
      { href: "#/", label: "Início", icon: "grid" },
    ];
  }
  if (role === "profissional") {
    return [
      { href: "#/profissional", label: "Minha agenda", icon: "calendar" },
      { href: "#/", label: "Início", icon: "grid" },
    ];
  }
  return base;
}
