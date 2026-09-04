import { renderPanel } from "../ui/layout.js";
import { requireRole, updateSessionUser } from "../services/auth.js";
import { $, $$, escapeHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { formatDateMedium } from "../ui/format.js";
import { loadProfessionals } from "../services/catalog.js";
import { listAppointments, cancelAppointment } from "../services/booking.js";
import { showToast } from "../ui/toast.js";
import { confirmDialog } from "../ui/modal.js";
import { initBookingWizard } from "../features/bookingWizard.js";
import { renderSettingsForm } from "../features/settingsForm.js";
import type { Appointment, Professional } from "../types.js";

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
  requireRole(["cliente"]);

  const { content, cleanup: cleanupPanel } = renderPanel(container, {
    title: "Minha Conta",
    roleLabel: "Cliente",
    links: [
      { href: "#/minha-conta", label: "Agendamentos", icon: "calendar" },
      { href: "#/minha-conta/configuracoes", label: "Configurações", icon: "cog" },
      { href: "#/", label: "Voltar ao site", icon: "arrow-left" },
    ],
  });

  const wizard = initBookingWizard({ onBookingCreated: () => renderAgendamentos() });
  const cleanups: Array<() => void> = [];

  let prosCache: Professional[] = loadProfessionals();

  function professionalName(id: string): string {
    return prosCache.find((p) => p.id === id)?.name ?? "-";
  }

  type ManageTab = "agendamentos" | "configuracoes";

  const base = "/minha-conta";

  function handleTab(tab: ManageTab): void {
    if (tab === "agendamentos") renderAgendamentos();
    else renderConfiguracoes();
  }

  // ------------------------------------------------------------- Agendamentos
  function renderAgendamentos(): void {
    prosCache = loadProfessionals();

    const currentYear = new Date().getFullYear();
    const defaultStart = `${currentYear}-01-01`;
    const defaultEnd = `${currentYear}-12-31`;

    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">MEUS AGENDAMENTOS</h3>
          <p class="manage-head__sub">Histórico completo das suas reservas</p>
        </div>
        <div class="toolbar">
          <select class="input" data-status-filter aria-label="Filtrar por status">
            <option value="todos">Todos Status</option>
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <div class="manage-search">
            ${icon("search", 16)}
            <input type="search" data-search-app placeholder="Buscar por serviço..." aria-label="Buscar por serviço">
          </div>
        </div>
      </div>

      <div class="panel__section adv-filter">
        <div class="adv-filter__title">CONSULTAR AGENDAMENTOS</div>
        <div class="adv-filter__row">
          <div class="field adv-filter__field">
            <span class="adv-filter__date">
              ${icon("calendar", 16)}
              <input type="date" data-inicio aria-label="Data inicial">
            </span>
          </div>
          <div class="field adv-filter__field">
            <span class="adv-filter__date">
              ${icon("calendar", 16)}
              <input type="date" data-fim aria-label="Data final">
            </span>
          </div>
          <div class="adv-filter__actions">
            <button type="button" class="btn adv-filter__consult" data-new-booking>${icon("plus", 14)} Novo agendamento</button>
            <button type="button" class="btn adv-filter__clear" data-clear-filter>Limpar Filtro</button>
          </div>
        </div>
      </div>

      <div class="table-wrap" id="conta-agenda-table">
        <p class="panel__empty">Carregando agendamentos...</p>
      </div>
    `;

    const search = $<HTMLInputElement>("[data-search-app]", content);
    const filter = $<HTMLSelectElement>("[data-status-filter]", content);
    const inicio = $<HTMLInputElement>("[data-inicio]", content);
    const fim = $<HTMLInputElement>("[data-fim]", content);

    if (inicio) inicio.value = defaultStart;
    if (fim) fim.value = defaultEnd;

    function applySearch(list: Appointment[]): Appointment[] {
      const q = (search?.value ?? "").trim().toLowerCase();
      if (!q) return list;
      return list.filter((a) => {
        const names = a.servicoNome ?? "";
        return names.toLowerCase().includes(q);
      });
    }

    function applyStatus(list: Appointment[]): Appointment[] {
      const status = filter?.value ?? "todos";
      if (status !== "todos") return list.filter((a) => a.status === status);
      return list;
    }

    function applyDates(list: Appointment[]): Appointment[] {
      const ini = inicio?.value;
      const fimv = fim?.value;
      if (!ini && !fimv) return list;
      return list.filter((a) => {
        if (ini && a.data < ini) return false;
        if (fimv && a.data > fimv) return false;
        return true;
      });
    }

    function refresh(list: Appointment[]): void {
      let filtered = applySearch(list);
      filtered = applyStatus(filtered);
      filtered = applyDates(filtered);
      $("#conta-agenda-table", content)!.innerHTML = buildTable(filtered);
      bindRows();
    }

    const onSearch = (): void => {
      void (async () => {
        refresh(await listAppointments());
      })();
    };
    const onFilter = (): void => {
      void (async () => {
        refresh(await listAppointments());
      })();
    };

    const onClear = (): void => {
      if (inicio) inicio.value = defaultStart;
      if (fim) fim.value = defaultEnd;
      if (search) search.value = "";
      if (filter) filter.value = "todos";
      void (async () => {
        refresh(await listAppointments());
      })();
    };

    search?.addEventListener("input", onSearch);
    filter?.addEventListener("change", onFilter);
    $<HTMLButtonElement>("[data-clear-filter]", content)?.addEventListener("click", onClear);
    $<HTMLButtonElement>("[data-new-booking]", content)?.addEventListener("click", () => wizard.openNew());

    cleanups.push(() => search?.removeEventListener("input", onSearch));
    cleanups.push(() => filter?.removeEventListener("change", onFilter));

    void (async () => {
      refresh(await listAppointments());
    })();
  }

  function buildTable(appointments: Appointment[]): string {
    if (appointments.length === 0) {
      return `<p class="panel__empty">Nenhum agendamento encontrado.</p>`;
    }
    return `
      <table class="table table--fit table--conta">
        <thead>
          <tr>
            <th>Serviço</th>
            <th>Profissional</th>
            <th>Data/Hora</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${appointments
            .map((a) => {
              const name = a.servicoNome ?? "-";
              let actions = `<span class="muted-note">-</span>`;
              if (a.status === "pendente" || a.status === "confirmado") {
                actions = `<span class="cell-actions">
                  <button type="button" class="btn btn--sm btn--ghost btn--ghost-gold" data-reschedule="${escapeHtml(a.id)}">REAGENDAR</button>
                  <button type="button" class="btn btn--sm btn--danger-outline" data-cancel="${escapeHtml(a.id)}">Cancelar</button>
                </span>`;
              }
              return `
                <tr>
                  <td><strong>${escapeHtml(name)}</strong></td>
                  <td>${escapeHtml(a.funcionarioNome ?? professionalName(a.funcionarioId))}</td>
                  <td>${formatDateMedium(a.data)} · ${a.hora}</td>
                  <td>${statusBadge(a.status)}</td>
                  <td>${actions}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function bindRows(): void {
    void (async () => {
      const appointments = await listAppointments();

      $$("[data-reschedule]", content).forEach((btn) => {
        const id = btn.getAttribute("data-reschedule")!;
        const appointment = appointments.find((a) => a.id === id);
        if (!appointment) return;
        const h = (): void => wizard.openForReschedule(appointment);
        btn.addEventListener("click", h);
        cleanups.push(() => btn.removeEventListener("click", h));
      });

      $$("[data-cancel]", content).forEach((btn) => {
        const id = btn.getAttribute("data-cancel")!;
        const appointment = appointments.find((a) => a.id === id);
        if (!appointment) return;
        const h = (): void => {
          void handleCancel(appointment);
        };
        btn.addEventListener("click", h);
        cleanups.push(() => btn.removeEventListener("click", h));
      });
    })();
  }

  async function handleCancel(appointment: Appointment): Promise<void> {
    const confirmed = await confirmDialog({
      title: "Cancelar agendamento",
      message: `Tem certeza que deseja cancelar o agendamento de ${appointment.servicoNome ?? "serviço"}? Essa ação não pode ser desfeita.`,
      confirmLabel: "Sim, cancelar",
      cancelLabel: "Manter",
      danger: true,
    });
    if (!confirmed) return;
    const updated = appointment.status === "pendente" || appointment.status === "confirmado"
      ? await cancelAppointment(appointment.id)
      : null;
    if (updated) {
      showToast("Agendamento cancelado.");
    } else {
      showToast("Não foi possível cancelar. Tente novamente.", "error");
    }
    renderAgendamentos();
  }

  // ------------------------------------------------------------- Configurações
  function renderConfiguracoes(): void {
    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">CONFIGURAÇÕES</h3>
          <p class="manage-head__sub">Segurança e dados do usuário</p>
        </div>
      </div>
    `;
    const formContainer = document.createElement("div");
    content.appendChild(formContainer);

    cleanups.push(
      renderSettingsForm(formContainer, async (data) => {
        const result = await updateSessionUser(data);
        if (!result.ok) {
          showToast(result.message ?? "Não foi possível salvar.", "error");
          return false;
        }
        return true;
      }),
    );
  }

  // ------------------------------------------------------------- Tab routing
  const linkHandler = (): void => {
    const path = window.location.hash.slice(1);
    if (path === `${base}/configuracoes`) handleTab("configuracoes");
    else handleTab("agendamentos");
  };
  linkHandler();
  window.addEventListener("hashchange", linkHandler);
  cleanups.push(() => window.removeEventListener("hashchange", linkHandler));

  return () => {
    cleanups.forEach((fn) => fn());
    cleanupPanel();
  };
}
