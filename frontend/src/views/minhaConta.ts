import { renderPanel } from "../ui/layout.js";
import { requireRole } from "../services/auth.js";
import { $, clearElement, escapeHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { formatCurrency, formatDateMedium, toIsoDate } from "../ui/format.js";
import { loadProfessionals, loadServices } from "../services/catalog.js";
import { cancelAppointment, listByEmail } from "../services/booking.js";
import { confirmDialog } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { initBookingWizard } from "../features/bookingWizard.js";
import type { Appointment } from "../types.js";

const STATUS_LABEL: Record<Appointment["status"], string> = {
  confirmado: "Confirmado",
  pendente: "Pendente",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function statusBadge(status: Appointment["status"]): string {
  const variant =
    status === "confirmado"
      ? "success"
      : status === "cancelado"
        ? "danger"
        : status === "pendente"
          ? "warning"
          : "neutral";
  return `<span class="badge badge--${variant}">${STATUS_LABEL[status]}</span>`;
}

export function renderMinhaConta(container: HTMLElement): () => void {
  const session = requireRole(["cliente"]);

  const { content, cleanup: cleanupPanel } = renderPanel(container, {
    title: "Minha Conta",
    roleLabel: "Cliente",
    links: [
      { href: "#/minha-conta/proximos", label: "Próximos", icon: "calendar" },
      { href: "#/minha-conta/historico", label: "Histórico", icon: "clock" },
      { href: "#/minha-conta/perfil", label: "Perfil", icon: "user" },
      { href: "#/", label: "Início", icon: "grid" },
    ],
  });

  const wizard = initBookingWizard({ onBookingCreated: () => renderList() });
  const cleanups: Array<() => void> = [];

  function refreshCatalog() {
    return { services: loadServices(), professionals: loadProfessionals() };
  }

  function serviceNames(all: Appointment, services: ReturnType<typeof loadServices>): string {
    return all.serviceIds
      .map((id) => services.find((s) => s.id === id)?.name ?? "")
      .filter(Boolean)
      .join(", ");
  }

  function totalOf(all: Appointment, services: ReturnType<typeof loadServices>): number {
    let total = 0;
    for (const id of all.serviceIds) {
      total += services.find((s) => s.id === id)?.price ?? 0;
    }
    return total;
  }

  function professionalName(all: Appointment, professionals: ReturnType<typeof loadProfessionals>): string {
    return professionals.find((p) => p.id === all.professionalId)?.name ?? "-";
  }

  function renderList(): void {
    const { services, professionals } = refreshCatalog();
    const all = listByEmail(session.userEmail).sort((a, b) => {
      const ka = `${a.dateIso}T${a.time}`;
      const kb = `${b.dateIso}T${b.time}`;
      return ka.toString().localeCompare(kb.toString());
    });
    const todayIso = toIsoDate(new Date());
    const upcoming = all.filter((a) => {
      if (a.status === "cancelado" || a.status === "concluido") return false;
      const when = `${a.dateIso}T${a.time}`;
      return when >= `${todayIso}T00:00`;
    });

    const target = $("#account-list")!;
    const list = upcoming;
    clearElement(target);

    content.querySelector(".account__subtitle")!.textContent =
      list.length === 0
        ? "Você ainda não tem agendamentos futuros."
        : `Você tem ${list.length} agendamento(s) futuro(s).`;

    if (list.length === 0) {
      target.innerHTML = `<div class="empty-state">${icon("calendar", 26)}<p>Nenhum agendamento aqui.</p></div>`;
      return;
    }

    for (const appointment of list) {
      const soon = appointment.status === "confirmado";
      const card = document.createElement("article");
      card.className = "account-card";
      card.innerHTML = `
        <div class="account-card__head">
          <div class="account-card__title">
            <strong>${escapeHtml(serviceNames(appointment, services))}</strong>
            <span class="account-card__date">${icon("clock", 14)} ${formatDateMedium(appointment.dateIso)} · ${appointment.time}</span>
          </div>
          ${statusBadge(appointment.status)}
        </div>
        <div class="account-card__meta">
          <span>${escapeHtml(professionalName(appointment, professionals))}</span>
          <span>${formatCurrency(totalOf(appointment, services))}</span>
        </div>
        <div class="account-card__actions">
          <div>
            ${soon ? `<button type="button" class="btn btn--sm btn--outline" data-reschedule="${escapeHtml(appointment.code)}">Reagendar</button>` : ""}
            ${appointment.status === "pendente" || appointment.status === "confirmado" ? `<button type="button" class="btn btn--sm btn--danger" data-cancel="${escapeHtml(appointment.code)}">Cancelar</button>` : ""}
          </div>
        </div>`;
      card.querySelector("[data-cancel]")?.addEventListener("click", () => {
        void handleCancel(appointment);
      });
      card.querySelector("[data-reschedule]")?.addEventListener("click", () => {
        wizard.openForReschedule(appointment);
      });
      target.appendChild(card);
    }
  }

  async function handleCancel(appointment: Appointment): Promise<void> {
    const confirmed = await confirmDialog({
      title: "Cancelar agendamento",
      message: `Tem certeza que deseja cancelar o agendamento ${appointment.code}? Essa ação não pode ser desfeita.`,
      confirmLabel: "Sim, cancelar",
      cancelLabel: "Manter",
      danger: true,
    });
    if (!confirmed) return;
    const updated = await cancelAppointment(appointment.code);
    if (updated) {
      showToast(`Agendamento ${updated.code} cancelado.`);
    } else {
      showToast("Não foi possível cancelar. Tente novamente.", "error");
    }
    renderList();
  }

  content.innerHTML = `
    <div class="panel__section" data-account-section>
      <div class="panel__section-header">
        <div>
          <h2 class="panel__section-title">Meus agendamentos</h2>
          <p class="account__subtitle"></p>
        </div>
        <button type="button" class="btn btn--primary" id="account-new-booking">${icon("plus", 16)} Novo agendamento</button>
      </div>
      <div id="account-list"></div>
    </div>
  `;

  const newBookingBtn = $<HTMLButtonElement>("#account-new-booking", content);
  if (newBookingBtn) {
    newBookingBtn.addEventListener("click", () => wizard.openNew());
  }

  renderList();

  return () => {
    cleanups.forEach((fn) => fn());
    cleanupPanel();
  };
}
