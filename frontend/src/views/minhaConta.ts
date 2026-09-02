import { renderPanel } from "../ui/layout.js";
import { requireRole } from "../services/auth.js";
import { $$, $, clearElement, escapeHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { formatCurrency, formatDateMedium, toIsoDate } from "../ui/format.js";
import { loadProfessionals, loadServices } from "../services/catalog.js";
import { findClienteByEmail, updateCliente } from "../services/clientes.js";
import { cancelAppointment, listByEmail } from "../services/booking.js";
import { confirmDialog } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { initBookingWizard } from "../features/bookingWizard.js";
import type { Appointment } from "../types.js";

type Tab = "proximos" | "historico" | "perfil";

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

  const wizard = initBookingWizard();
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
    const history = all.filter((a) => !upcoming.includes(a));

    const tab = (document.querySelector("[data-account-tab]")?.getAttribute("data-account-tab") ?? "proximos") as Tab;
    const list = tab === "proximos" ? upcoming : history;
    const target = $("#account-list")!;
    clearElement(target);

    if (tab === "proximos") {
      content.querySelector(".account__subtitle")!.textContent =
        list.length === 0
          ? "Você ainda não tem agendamentos futuros."
          : `Você tem ${list.length} agendamento(s) futuro(s).`;
    } else {
      content.querySelector(".account__subtitle")!.textContent =
        list.length === 0 ? "Seu histórico está vazio." : `${list.length} agendamento(s) no histórico.`;
    }

    if (list.length === 0) {
      target.innerHTML = `<div class="empty-state">${icon("calendar", 26)}<p>Nenhum agendamento aqui.</p></div>`;
      return;
    }

    for (const appointment of list) {
      const soon = tab === "proximos" && appointment.status === "confirmado";
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
          <span class="account-card__code">${escapeHtml(appointment.code)}</span>
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

  function renderPerfil(): void {
    const target = $("#account-profile")!;
    const client = findClienteByEmail(session.userEmail);
    const current = client ?? { nome: "", telefone: "", email: "" };
    target.innerHTML = `
      <div class="card account-profile">
        <h3 class="panel__section-title">Meus dados</h3>
        <form id="profile-form" novalidate>
          <div class="field">
            <label class="field__label" for="profile-name">Nome completo</label>
            <input type="text" id="profile-name" value="${escapeHtml(current.nome)}" maxlength="80" required>
            <span class="field__error">Informe seu nome completo.</span>
          </div>
          <div class="field">
            <label class="field__label" for="profile-phone">Telefone / WhatsApp</label>
            <input type="tel" id="profile-phone" value="${escapeHtml(current.telefone)}" maxlength="15">
            <span class="field__error">Informe um telefone válido.</span>
          </div>
          <div class="field">
            <label class="field__label" for="profile-email">Email</label>
            <input type="email" id="profile-email" value="${escapeHtml(current.email)}" disabled>
          </div>
          <button type="submit" class="btn btn--primary">Salvar alterações</button>
        </form>
      </div>
    `;
    const form = $<HTMLFormElement>("#profile-form", target)!;
    const formCleanup = (): void => form.removeEventListener("submit", handler);
    const handler = (event: Event): void => {
      event.preventDefault();
      const nameInput = $<HTMLInputElement>("#profile-name", target)!;
      const phoneInput = $<HTMLInputElement>("#profile-phone", target)!;
      let valid = true;
      if (nameInput.value.trim().length < 3 || !nameInput.value.includes(" ")) {
        valid = false;
      }
      if (phoneInput.value.replace(/\D/g, "").length < 10) {
        valid = false;
      }
      if (!valid) {
        showToast("Verifique os dados informados.", "error");
        return;
      }
      const client = findClienteByEmail(session.userEmail);
      if (client) {
        updateCliente(client.id, { nome: nameInput.value, telefone: phoneInput.value });
        showToast("Perfil atualizado com sucesso!", "success");
      }
    };
    form.addEventListener("submit", handler);
    cleanups.push(formCleanup);
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
      <div class="account-tabs" role="tablist">
        <button class="account-tabs__btn is-active" data-account-tab="proximos" role="tab">Próximos</button>
        <button class="account-tabs__btn" data-account-tab="historico" role="tab">Histórico</button>
        <button class="account-tabs__btn" data-account-tab="perfil" role="tab">Perfil</button>
      </div>
      <div id="account-list"></div>
      <div id="account-profile"></div>
    </div>
  `;

  const newBookingBtn = $<HTMLButtonElement>("#account-new-booking", content);
  if (newBookingBtn) {
    newBookingBtn.addEventListener("click", () => wizard.openNew());
  }

  const tabHandler = (event: Event): void => {
    const btn = event.currentTarget as HTMLButtonElement;
    const tab = btn.dataset.accountTab as Tab;
    $("#account-list", content)!.hidden = tab === "perfil";
    $("#account-profile", content)!.hidden = tab !== "perfil";
    $$(".account-tabs__btn", content).forEach((b) => b.classList.toggle("is-active", b === btn));
    if (tab === "perfil") {
      renderPerfil();
    } else {
      renderList();
    }
  };
  $$(".account-tabs__btn", content).forEach((btn) => btn.addEventListener("click", tabHandler));
  cleanups.push(() => $$(".account-tabs__btn", content).forEach((btn) => btn.removeEventListener("click", tabHandler)));

  const path = window.location.hash;
  let initialTab: Tab = "proximos";
  if (path.includes("historico")) initialTab = "historico";
  else if (path.includes("perfil")) initialTab = "perfil";
  $$(".account-tabs__btn", content).forEach((b) =>
    b.classList.toggle("is-active", b.dataset.accountTab === initialTab),
  );
  $("#account-list", content)!.hidden = initialTab === "perfil";
  $("#account-profile", content)!.hidden = initialTab !== "perfil";
  if (initialTab === "perfil") {
    renderPerfil();
  } else {
    renderList();
  }

  return () => {
    cleanups.forEach((fn) => fn());
    cleanupPanel();
  };
}
