import { renderPanel } from "../ui/layout.js";
import { requireRole } from "../services/auth.js";
import { icon } from "../ui/icons.js";
import type { UserRole } from "../types.js";

const CONFIG_ROLES: Record<string, { allowed: UserRole[]; title: string; label: string; text: string; links: Array<{ href: string; label: string; icon: string }> }> = {
  profissional: {
    allowed: ["profissional"],
    title: "Minha Agenda",
    label: "Profissional",
    text: "Esta área está em construção. Em breve o profissional poderá gerenciar sua própria agenda e atendimentos.",
    links: [
      { href: "#/profissional", label: "Minha agenda", icon: "calendar" },
      { href: "#/", label: "Início", icon: "grid" },
    ],
  },
};

export function renderPlaceholderPanel(kind: "profissional" | "recepcionista") {
  return (container: HTMLElement): () => void => {
    const cfg = CONFIG_ROLES[kind]!;
    requireRole(cfg.allowed);
    const { content, cleanup } = renderPanel(container, {
      title: cfg.title,
      roleLabel: cfg.label,
      links: cfg.links,
    });

    content.innerHTML = `
      <div class="panel__section">
        <div class="panel__empty">
          ${icon("cog", 40)}
          <h2 class="panel__section-title">${cfg.label} — em construção</h2>
          <p>${cfg.text}</p>
        </div>
      </div>
    `;

    return cleanup;
  };
}
