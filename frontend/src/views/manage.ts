import { renderPanel } from "../ui/layout.js";
import { requireRole, updateSessionUser } from "../services/auth.js";
import { $$, $, escapeHtml, initials } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { formatCurrency, formatDateMedium } from "../ui/format.js";
import {
  loadServices,
  loadProfessionals,
  loadCategories,
  saveCategories,
  createServico,
  updateServico,
  setServicoStatus,
} from "../services/catalog.js";
import {
  listAppointments,
  cancelAppointment,
  confirmAppointment,
  concludeAppointment,
} from "../services/booking.js";
import {
  createUsuarioInterno,
  deleteUsuarioInterno,
  findUsuarioByEmail,
  findByProfessionalId,
  updateUsuarioInterno,
} from "../services/usuarios.js";
import { DEFAULT_DAYS, loadSchedule, saveSchedule, type ScheduleConfig } from "../services/schedule.js";
import { confirmDialog, openModal, closeModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { renderSettingsForm } from "../features/settingsForm.js";
import type { Service, ServiceIcon, Appointment, Professional } from "../types.js";
import { CONFIG } from "../config.js";

type ManageTab = "dashboard" | "servicos" | "profissionais" | "agendamentos" | "configuracoes";

type DashboardFilterMode = "todos" | "ano" | "mes" | "periodo";

interface DashboardFilter {
  mode: DashboardFilterMode;
  ano: number;
  mes: number;
  inicio: string;
  fim: string;
}

const STATUS_LABEL: Record<Appointment["status"], string> = {
  confirmado: "Confirmado",
  pendente: "Pendente",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const WEEKDAY_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

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

let servicesCache: Service[] = [];
let prosCache: Professional[] = [];

function refreshCaches(): void {
  servicesCache = loadServices();
  prosCache = loadProfessionals();
}

function serviceName(id: string): string {
  return servicesCache.find((s) => s.id === id)?.name ?? "-";
}

function professionalName(id: string): string {
  return prosCache.find((p) => p.id === id)?.name ?? "-";
}

function serviceTotal(serviceId: string): number {
  return servicesCache.find((s) => s.id === serviceId)?.price ?? 0;
}

export function renderManage(container: HTMLElement): () => void {
  const session = requireRole(["admin", "recepcionista"]);
  const isAdmin = session.role === "admin";
  refreshCaches();

  const base = isAdmin ? "/admin" : "/recepcionista";

  const links = isAdmin
    ? [
        { href: `#${base}`, label: "Dashboard", icon: "grid" },
        { href: `#${base}/agendamentos`, label: "Agendamentos", icon: "calendar" },
        { href: `#${base}/servicos`, label: "Serviços", icon: "scissors" },
        { href: `#${base}/profissionais`, label: "Profissionais", icon: "users" },
        { href: `#${base}/configuracoes`, label: "Configurações", icon: "cog" },
        { href: "#/", label: "Voltar ao site", icon: "arrow-left" },
      ]
    : [
        { href: `#${base}`, label: "Agendamentos", icon: "calendar" },
        { href: `#${base}/servicos`, label: "Serviços", icon: "scissors" },
        { href: `#${base}/profissionais`, label: "Profissionais", icon: "users" },
        { href: `#${base}/configuracoes`, label: "Configurações", icon: "cog" },
        { href: "#/", label: "Voltar ao site", icon: "arrow-left" },
      ];

  const { content, cleanup: cleanupPanel } = renderPanel(container, {
    title: isAdmin ? "Administração" : "Recepção",
    roleLabel: isAdmin ? "Administrador" : "Recepcionista",
    links,
  });

  const cleanups: Array<() => void> = [];
  const state: DashboardFilter = {
    mode: "todos",
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    inicio: "",
    fim: "",
  };

  function handleTab(tab: ManageTab): void {
    if (tab === "dashboard") void renderDashboard();
    else if (tab === "servicos") renderServicos();
    else if (tab === "profissionais") void renderProfissionais();
    else if (tab === "configuracoes") renderConfiguracoes();
    else void renderAgendamentos();
  }

  // ---------------------------------------------------------------- Dashboard
  async function renderDashboard(): Promise<void> {
    refreshCaches();
    const appointments = await listAppointments();

    const years = availableYears(appointments);
    const selectedYear = years.includes(state.ano) ? state.ano : years[years.length - 1] ?? new Date().getFullYear();
    state.ano = selectedYear;

    content.innerHTML = `
      <div class="panel__section dashboard-filter">
        <div class="dashboard-filter__row">
          <div class="field">
            <label class="field__label" for="dashboard-mode">Período</label>
            <select class="input" id="dashboard-mode" aria-label="Tipo de filtro">
              <option value="todos" ${state.mode === "todos" ? "selected" : ""}>Todos os registros</option>
              <option value="ano" ${state.mode === "ano" ? "selected" : ""}>Por ano</option>
              <option value="mes" ${state.mode === "mes" ? "selected" : ""}>Por mês de um ano</option>
              <option value="periodo" ${state.mode === "periodo" ? "selected" : ""}>Por período</option>
            </select>
          </div>
          <div class="field" id="dashboard-ano-wrap" ${state.mode === "ano" || state.mode === "mes" ? "" : "hidden"}>
            <label class="field__label" for="dashboard-ano">Ano</label>
            <select class="input" id="dashboard-ano" aria-label="Selecionar ano">
              ${years
                .map(
                  (y) =>
                    `<option value="${y}" ${y === state.ano ? "selected" : ""}>${y}</option>`,
                )
                .join("")}
            </select>
          </div>
          <div class="field" id="dashboard-mes-wrap" ${state.mode === "mes" ? "" : "hidden"}>
            <label class="field__label" for="dashboard-mes">Mês</label>
            <select class="input" id="dashboard-mes" aria-label="Selecionar mês">
              ${MONTHS.map(
                (name, i) =>
                  `<option value="${i + 1}" ${i + 1 === state.mes ? "selected" : ""}>${name}</option>`,
              ).join("")}
            </select>
          </div>
          <div class="field" id="dashboard-periodo-wrap" ${state.mode === "periodo" ? "" : "hidden"}>
            <label class="field__label" for="dashboard-inicio">De</label>
            <input type="date" class="input" id="dashboard-inicio" value="${state.inicio}">
          </div>
          <div class="field" id="dashboard-fim-wrap" ${state.mode === "periodo" ? "" : "hidden"}>
            <label class="field__label" for="dashboard-fim">Até</label>
            <input type="date" class="input" id="dashboard-fim" value="${state.fim}">
          </div>
        </div>
      </div>
      <div id="dashboard-metrics">${dashboardMetricsHTML(appointments)}</div>
    `;

    const modeSelect = $<HTMLSelectElement>("#dashboard-mode", content);
    const anoSelect = $<HTMLSelectElement>("#dashboard-ano", content);
    const mesSelect = $<HTMLSelectElement>("#dashboard-mes", content);
    const inicioInput = $<HTMLInputElement>("#dashboard-inicio", content);
    const fimInput = $<HTMLInputElement>("#dashboard-fim", content);
    const anoWrap = $("#dashboard-ano-wrap", content);
    const mesWrap = $("#dashboard-mes-wrap", content);
    const periodoWrap = $("#dashboard-periodo-wrap", content);
    const fimWrap = $("#dashboard-fim-wrap", content);

    const refresh = (): void => {
      void (async () => {
        const appts = await listAppointments();
        $("#dashboard-metrics", content)!.innerHTML = dashboardMetricsHTML(appts);
      })();
    };

    const modeHandler = (): void => {
      state.mode = (modeSelect?.value ?? "todos") as DashboardFilterMode;
      if (state.mode === "todos") {
        state.inicio = "";
        state.fim = "";
        if (inicioInput) inicioInput.value = "";
        if (fimInput) fimInput.value = "";
      }
      if (anoWrap) anoWrap.hidden = !(state.mode === "ano" || state.mode === "mes");
      if (mesWrap) mesWrap.hidden = state.mode !== "mes";
      if (periodoWrap) periodoWrap.hidden = state.mode !== "periodo";
      if (fimWrap) fimWrap.hidden = state.mode !== "periodo";
      refresh();
    };

    const anoHandler = (): void => {
      if (!anoSelect) return;
      state.ano = Number(anoSelect.value);
      refresh();
    };
    const mesHandler = (): void => {
      if (!mesSelect) return;
      state.mes = Number(mesSelect.value);
      refresh();
    };
    const inicioHandler = (): void => {
      if (!inicioInput) return;
      state.inicio = inicioInput.value;
      refresh();
    };
    const fimHandler = (): void => {
      if (!fimInput) return;
      state.fim = fimInput.value;
      refresh();
    };

    modeSelect?.addEventListener("change", modeHandler);
    anoSelect?.addEventListener("change", anoHandler);
    mesSelect?.addEventListener("change", mesHandler);
    inicioInput?.addEventListener("change", inicioHandler);
    fimInput?.addEventListener("change", fimHandler);

    cleanups.push(() => modeSelect?.removeEventListener("change", modeHandler));
    cleanups.push(() => anoSelect?.removeEventListener("change", anoHandler));
    cleanups.push(() => mesSelect?.removeEventListener("change", mesHandler));
    cleanups.push(() => inicioInput?.removeEventListener("change", inicioHandler));
    cleanups.push(() => fimInput?.removeEventListener("change", fimHandler));
  }

  function matchesFilter(a: Appointment): boolean {
    const m = monthOf(a.data);
    const y = yearOf(a.data);
    switch (state.mode) {
      case "ano":
        return y === state.ano;
      case "mes":
        return y === state.ano && m === state.mes;
      case "periodo": {
        if (state.inicio && a.data < state.inicio) return false;
        if (state.fim && a.data > state.fim) return false;
        return true;
      }
      default:
        return true;
    }
  }

  function dashboardMetricsHTML(appointments: Appointment[]): string {
    const filtered = appointments.filter(matchesFilter);
    const counts: Record<Appointment["status"], number> = {
      confirmado: 0,
      pendente: 0,
      concluido: 0,
      cancelado: 0,
    };
    for (const a of filtered) counts[a.status] += 1;

    // Bloco financeiro restrito ao Administrador (PRD: recepcionista não tem acesso financeiro).
    const financial = isAdmin
      ? (() => {
          let revenue = 0;
          const sold: Record<string, number> = {};
          for (const a of filtered) {
            if (a.status === "cancelado") continue;
            revenue += serviceTotal(a.servicoId);
            sold[a.servicoId] = (sold[a.servicoId] ?? 0) + 1;
          }
          const top = Object.entries(sold).sort((x, y) => y[1] - x[1]).slice(0, 3);
          return { revenue, top };
        })()
      : null;

    return `
      <div class="kpi-grid">
        <div class="kpi-card"><span class="kpi-card__label">${icon("calendar", 16)} Total</span><span class="kpi-card__value">${filtered.length}</span></div>
        <div class="kpi-card"><span class="kpi-card__label">${icon("check-circle", 16)} Confirmados</span><span class="kpi-card__value kpi-card__value--success">${counts.confirmado}</span></div>
        <div class="kpi-card"><span class="kpi-card__label">${icon("clock", 16)} Pendentes</span><span class="kpi-card__value kpi-card__value--gold">${counts.pendente}</span></div>
        <div class="kpi-card"><span class="kpi-card__label">${icon("x", 16)} Cancelados</span><span class="kpi-card__value kpi-card__value--danger">${counts.cancelado}</span></div>
        ${financial ? `<div class="kpi-card"><span class="kpi-card__label">${icon("dollar", 16)} Faturamento</span><span class="kpi-card__value kpi-card__value--gold">${formatCurrency(financial.revenue)}</span></div>` : ""}
      </div>
      ${financial ? `
      <div class="panel__section">
        <h3 class="panel__section-title">Serviços mais vendidos</h3>
        <div class="card">
          ${financial.top.length === 0 ? `<p class="panel__empty">Ainda não há dados suficientes.</p>` : ""}
          ${financial.top
            .map(
              ([id, count]) =>
                `<div class="top-service"><span>${escapeHtml(serviceName(id))}</span><strong>${count}×</strong></div>`,
            )
            .join("")}
        </div>
      </div>` : ""}
    `;
  }

  function monthOf(iso: string): number {
    const m = Number(iso.slice(5, 7));
    return Number.isNaN(m) ? -1 : m;
  }

  function yearOf(iso: string): number {
    const y = Number(iso.slice(0, 4));
    return Number.isNaN(y) ? -1 : y;
  }

  function availableYears(appointments: Appointment[]): number[] {
    const set = new Set<number>();
    for (const a of appointments) {
      const y = yearOf(a.data);
      if (y >= 0) set.add(y);
    }
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => a - b);
  }

  // ----------------------------------------------------------- Agendamentos
  async function renderAgendamentos(): Promise<void> {
    refreshCaches();
    const appointments = (await listAppointments()).sort((a, b) => {
      const ka = `${a.data}T${a.hora}`;
      const kb = `${b.data}T${b.hora}`;
      return kb.toString().localeCompare(ka.toString());
    });

    const currentYear = new Date().getFullYear();
    const defaultStart = `${currentYear}-01-01`;
    const defaultEnd = `${currentYear}-12-31`;

    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">Agendamentos</h3>
          <p class="manage-head__sub">Controle completo da agenda do salão e status das reservas</p>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn--ghost" data-open-agenda>${icon("sliders", 16)} Configurar agenda</button>
        </div>
      </div>
      <div class="manage-toolbar">
        <div class="manage-search">
          ${icon("search", 16)}
          <input type="search" data-search-app placeholder="Buscar cliente..." aria-label="Buscar cliente">
        </div>
        <select class="input" data-status-filter aria-label="Filtrar por status">
          <option value="todos">Todos os status</option>
          <option value="confirmado">Confirmados</option>
          <option value="pendente">Pendentes</option>
          <option value="concluido">Concluídos</option>
          <option value="cancelado">Cancelados</option>
        </select>
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
            <button type="button" class="btn adv-filter__consult" data-consult>Consultar</button>
            <button type="button" class="btn adv-filter__clear" data-clear-filter>Limpar Filtro</button>
          </div>
        </div>
      </div>
      <div class="table-wrap" id="manage-agenda-table">
        ${buildAgendamentosTable(appointments)}
      </div>
    `;

    const search = $<HTMLInputElement>("[data-search-app]", content);
    const filter = $<HTMLSelectElement>("[data-status-filter]", content);
    const inicio = $<HTMLInputElement>("[data-inicio]", content);
    const fim = $<HTMLInputElement>("[data-fim]", content);
    if (inicio) inicio.value = defaultStart;
    if (fim) fim.value = defaultEnd;
    const applyFilters = (): void => {
      const q = (search?.value ?? "").trim().toLowerCase();
      const status = filter?.value ?? "todos";
      const ini = inicio?.value ?? "";
      const fimv = fim?.value ?? "";
      const filtered = appointments.filter((a) => {
        if (status !== "todos" && a.status !== status) return false;
        if (q && !(a.clienteNome ?? "").toLowerCase().includes(q)) return false;
        if (ini && a.data < ini) return false;
        if (fimv && a.data > fimv) return false;
        return true;
      });
      $("#manage-agenda-table", content)!.innerHTML = buildAgendamentosTable(filtered);
      bindAgendaRows();
    };

    const applyHandler = (): void => applyFilters();
    search?.addEventListener("input", applyHandler);
    filter?.addEventListener("change", applyHandler);
    inicio?.addEventListener("change", applyHandler);
    fim?.addEventListener("change", applyHandler);
    $<HTMLButtonElement>("[data-consult]", content)?.addEventListener("click", applyHandler);
    const clearBtn = $<HTMLButtonElement>("[data-clear-filter]", content);
    if (clearBtn) {
      const clearHandler = (): void => {
        if (inicio) inicio.value = defaultStart;
        if (fim) fim.value = defaultEnd;
        if (search) search.value = "";
        if (filter) filter.value = "todos";
        applyFilters();
      };
      clearBtn.addEventListener("click", clearHandler);
      cleanups.push(() => clearBtn.removeEventListener("click", clearHandler));
    }
    cleanups.push(() => search?.removeEventListener("input", applyHandler));
    cleanups.push(() => filter?.removeEventListener("change", applyHandler));
    cleanups.push(() => inicio?.removeEventListener("change", applyHandler));
    cleanups.push(() => fim?.removeEventListener("change", applyHandler));

    const openAgendaBtn = $<HTMLButtonElement>("[data-open-agenda]", content);
    if (openAgendaBtn) {
      const h = (): void => {
        void openScheduleModal();
      };
      openAgendaBtn.addEventListener("click", h);
      cleanups.push(() => openAgendaBtn.removeEventListener("click", h));
    }

    bindAgendaRows();
  }

  function bindAgendaRows(): void {
    $$("[data-confirm-app]", content).forEach((btn) => {
      const id = btn.getAttribute("data-id")!;
      const h = (): void => {
        void handleSetStatus(id, "confirmado");
      };
      btn.addEventListener("click", h);
      cleanups.push(() => btn.removeEventListener("click", h));
    });

    $$("[data-conclude-app]", content).forEach((btn) => {
      const id = btn.getAttribute("data-id")!;
      const h = (): void => {
        void handleSetStatus(id, "concluido");
      };
      btn.addEventListener("click", h);
      cleanups.push(() => btn.removeEventListener("click", h));
    });

    $$("[data-cancel-app]", content).forEach((btn) => {
      const id = btn.getAttribute("data-id")!;
      const h = (): void => {
        void handleSetStatus(id, "cancelado");
      };
      btn.addEventListener("click", h);
      cleanups.push(() => btn.removeEventListener("click", h));
    });

    $$("[data-row-detail]", content).forEach((row) => {
      const id = row.getAttribute("data-row-detail")!;
      const h = (event: Event): void => {
        if (event.target instanceof Element && event.target.closest("button, a, select, input")) return;
        void (async () => {
          const appts = await listAppointments();
          const app = appts.find((a) => a.id === id) ?? null;
          if (app) openDetailModal(app);
        })();
      };
      row.addEventListener("click", h);
      cleanups.push(() => row.removeEventListener("click", h));
    });
  }

  async function handleSetStatus(id: string, status: Appointment["status"]): Promise<void> {
    const appts = await listAppointments();
    const app = appts.find((a) => a.id === id);

    if (status === "cancelado") {
      const confirmed = await confirmDialog({
        title: "Cancelar agendamento",
        message: `Confirmar o cancelamento do agendamento de ${app?.clienteNome ?? "cliente"}?`,
        confirmLabel: "Cancelar agendamento",
        danger: true,
      });
      if (!confirmed) return;
      await cancelAppointment(id);
      showToast("Agendamento cancelado.");
    } else if (status === "confirmado") {
      const confirmed = await confirmDialog({
        title: "Confirmar presença",
        message: "Marcar este agendamento como confirmado?",
        confirmLabel: "Confirmar",
      });
      if (!confirmed) return;
      await confirmAppointment(id);
      showToast("Presença confirmada.");
    } else if (status === "concluido") {
      const confirmed = await confirmDialog({
        title: "Concluir atendimento",
        message: "Marcar este agendamento como concluído?",
        confirmLabel: "Concluir",
      });
      if (!confirmed) return;
      await concludeAppointment(id);
      showToast("Atendimento concluído.");
    }
    await renderAgendamentos();
  }

  function buildAgendamentosTable(appointments: Appointment[]): string {
    if (appointments.length === 0) {
      return `<p class="panel__empty">Nenhum agendamento encontrado.</p>`;
    }
    return `
      <table class="table table--fit">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Profissional</th>
            <th>Serviço</th>
            <th>Data/Hora</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${appointments
            .map((a) => {
              const name = a.servicoNome ?? "-";
              const cliente = a.clienteNome ?? "-";
              const funcionario = a.funcionarioNome ?? professionalName(a.funcionarioId) ?? "-";
              let actions = "";
              if (a.status === "pendente") {
                actions = `<span class="actions-cell">
                  <button type="button" class="btn btn--sm btn--success" data-confirm-app data-id="${escapeHtml(a.id)}">CONFIRMAR</button>
                  <button type="button" class="btn btn--sm btn--ghost btn--ghost-gold" data-conclude-app data-id="${escapeHtml(a.id)}">CONCLUIR</button>
                  <button type="button" class="btn btn--sm btn--danger-outline" data-cancel-app data-id="${escapeHtml(a.id)}">Cancelar</button>
                </span>`;
              } else if (a.status === "confirmado") {
                actions = `<span class="actions-cell">
                  <button type="button" class="btn btn--sm btn--ghost btn--ghost-gold" data-conclude-app data-id="${escapeHtml(a.id)}">CONCLUIR</button>
                  <button type="button" class="btn btn--sm btn--danger-outline" data-cancel-app data-id="${escapeHtml(a.id)}">Cancelar</button>
                </span>`;
              } else {
                actions = `<span class="actions-cell"><span class="muted-note">Sem ações</span></span>`;
              }
              return `
                <tr class="is-clickable" data-row-detail="${escapeHtml(a.id)}" tabindex="0">
                  <td><strong>${escapeHtml(cliente)}</strong></td>
                  <td>${escapeHtml(funcionario)}</td>
                  <td>${escapeHtml(name)}</td>
                  <td>${formatDateMedium(a.data)} · ${a.hora}</td>
                  <td>${statusBadge(a.status)}</td>
                  <td><span class="cell-actions">${actions}</span></td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  // ------------------------------------------------------- Agenda config modal
  async function openScheduleModal(): Promise<void> {
    // Em modo API, horários são por funcionário; resolve o perfil do usuário logado.
    const usuario = await findUsuarioByEmail(session.userEmail);
    const professionalId = usuario?.professionalId ?? null;
    if (!professionalId) {
      showToast("Não foi possível identificar seu perfil de funcionário.", "error");
      return;
    }
    const config = await loadSchedule(professionalId);
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="modal modal--lg" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
        <div class="modal__header">
          <h2 class="modal__title" id="schedule-modal-title">Configuração de funcionamento da agenda</h2>
          <button type="button" class="modal__close" data-close aria-label="Fechar">${icon("x", 18)}</button>
        </div>
        <div class="modal__body">
          <form id="schedule-form" novalidate>
            <h4 class="manage-form-title">Horário padrão da semana</h4>
            <div class="schedule-days">
              ${DEFAULT_DAYS.map((day, index) => {
                const dayCfg = config.weekly[day] ?? { open: false, start: "09:00", end: "19:00" };
                return `
                  <div class="schedule-day">
                    <label class="check-line schedule-day__check">
                      <input type="checkbox" data-day-toggle="${day}" ${dayCfg.open ? "checked" : ""}>
                      <span>${WEEKDAY_LABEL[index] ?? day}</span>
                    </label>
                    <div class="schedule-day__times">
                      <input type="time" data-day-start="${day}" value="${dayCfg.start}" ${dayCfg.open ? "" : "disabled"}>
                      <span class="schedule-day__sep">até</span>
                      <input type="time" data-day-end="${day}" value="${dayCfg.end}" ${dayCfg.open ? "" : "disabled"}>
                    </div>
                  </div>`;
              }).join("")}
            </div>

            <h4 class="manage-form-title">Dias indisponíveis</h4>
            <div class="schedule-row">
              <input type="date" data-blocked-date>
              <button type="button" class="btn btn--primary" data-add-blocked>${icon("plus", 14)} Bloquear data</button>
            </div>
            <ul class="schedule-list" data-blocked-list>
              ${config.blockedDates
                .map(
                  (d) =>
                    `<li><span>${escapeHtml(formatDateMedium(d))}</span><button type="button" class="btn btn--sm btn--ghost" data-remove-blocked="${escapeHtml(d)}" aria-label="Remover">${icon("x", 14)}</button></li>`,
                )
                .join("")}
            </ul>

            <h4 class="manage-form-title">Abertura excepcional</h4>
            <div class="schedule-row schedule-row--grid">
              <input type="date" data-ex-date>
              <input type="time" data-ex-start placeholder="Início">
              <input type="time" data-ex-end placeholder="Fim">
              <button type="button" class="btn btn--primary" data-add-exception>${icon("plus", 14)} Adicionar</button>
            </div>
            <ul class="schedule-list" data-exception-list>
              ${config.exceptions
                .map(
                  (e) =>
                    `<li><span>${escapeHtml(formatDateMedium(e.dateIso))} · ${e.start}–${e.end}</span><button type="button" class="btn btn--sm btn--ghost" data-remove-exception="${escapeHtml(e.dateIso)}" aria-label="Remover">${icon("x", 14)}</button></li>`,
                )
                .join("")}
            </ul>

            <div class="modal__footer">
              <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
              <button type="submit" class="btn btn--primary">Salvar configuração</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const finish = (): void => {
      closeModal(overlay);
      window.setTimeout(() => overlay.remove(), 300);
    };

    $$("[data-day-toggle]", overlay).forEach((cb) => {
      const day = Number(cb.getAttribute("data-day-toggle"));
      cb.addEventListener("change", (event) => {
        const checked = (event.target as HTMLInputElement).checked;
        const start = overlay.querySelector<HTMLInputElement>(`[data-day-start="${day}"]`)!;
        const end = overlay.querySelector<HTMLInputElement>(`[data-day-end="${day}"]`)!;
        start.disabled = !checked;
        end.disabled = !checked;
      });
    });

    overlay.querySelector("[data-add-blocked]")!.addEventListener("click", () => {
      const input = overlay.querySelector<HTMLInputElement>("[data-blocked-date]")!;
      if (!input.value) return;
      const dateIso = input.value;
      let blocked = config.blockedDates;
      if (!blocked.includes(dateIso)) {
        blocked = [...blocked, dateIso];
        const newConfig: ScheduleConfig = { ...config, blockedDates: blocked };
        void saveSchedule(newConfig, professionalId).then(() => {
          showToast("Data bloqueada.");
        });
        (overlay.querySelector("[data-blocked-list]") as HTMLUListElement).insertAdjacentHTML(
          "beforeend",
          `<li><span>${escapeHtml(formatDateMedium(dateIso))}</span><button type="button" class="btn btn--sm btn--ghost" data-remove-blocked="${escapeHtml(dateIso)}" aria-label="Remover">${icon("x", 14)}</button></li>`,
        );
      }
      input.value = "";
    });

    overlay.querySelector("[data-add-exception]")!.addEventListener("click", () => {
      const dateIso = (overlay.querySelector<HTMLInputElement>("[data-ex-date]")!).value;
      const start = (overlay.querySelector<HTMLInputElement>("[data-ex-start]")!).value;
      const end = (overlay.querySelector<HTMLInputElement>("[data-ex-end]")!).value;
      if (!dateIso || !start || !end) {
        showToast("Preencha data, início e fim.", "error");
        return;
      }
      let exceptions = config.exceptions.filter((e) => e.dateIso !== dateIso);
      exceptions = [...exceptions, { dateIso, start, end }];
      void saveSchedule({ ...config, exceptions }, professionalId).then(() => {
        showToast("Abertura excepcional adicionada.");
      });
      (overlay.querySelector("[data-exception-list]") as HTMLUListElement).insertAdjacentHTML(
        "beforeend",
        `<li><span>${escapeHtml(formatDateMedium(dateIso))} · ${start}–${end}</span><button type="button" class="btn btn--sm btn--ghost" data-remove-exception="${escapeHtml(dateIso)}" aria-label="Remover">${icon("x", 14)}</button></li>`,
      );
      (overlay.querySelector<HTMLInputElement>("[data-ex-date]")!).value = "";
      (overlay.querySelector<HTMLInputElement>("[data-ex-start]")!).value = "";
      (overlay.querySelector<HTMLInputElement>("[data-ex-end]")!).value = "";
    });

    overlay.querySelector("[data-blocked-list]")!.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement).closest("[data-remove-blocked]") as HTMLElement | null;
      if (!btn) return;
      const dateIso = btn.getAttribute("data-remove-blocked")!;
      const newConfig: ScheduleConfig = {
        ...config,
        blockedDates: config.blockedDates.filter((d) => d !== dateIso),
      };
      void saveSchedule(newConfig, professionalId).then(() => {
        btn.closest("li")?.remove();
        showToast("Data desbloqueada.");
      });
    });

    overlay.querySelector("[data-exception-list]")!.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement).closest("[data-remove-exception]") as HTMLElement | null;
      if (!btn) return;
      const dateIso = btn.getAttribute("data-remove-exception")!;
      const newConfig: ScheduleConfig = {
        ...config,
        exceptions: config.exceptions.filter((e) => e.dateIso !== dateIso),
      };
      void saveSchedule(newConfig, professionalId).then(() => {
        btn.closest("li")?.remove();
        showToast("Exceção removida.");
      });
    });

    overlay.querySelector<HTMLFormElement>("#schedule-form")!.addEventListener("submit", (event) => {
      event.preventDefault();
      const weekly: Record<number, { open: boolean; start: string; end: string }> = {};
      for (const day of DEFAULT_DAYS) {
        const open = (overlay.querySelector<HTMLInputElement>(`[data-day-toggle="${day}"]`)!).checked;
        weekly[day] = {
          open,
          start: (overlay.querySelector<HTMLInputElement>(`[data-day-start="${day}"]`)!).value,
          end: (overlay.querySelector<HTMLInputElement>(`[data-day-end="${day}"]`)!).value,
        };
      }
      void saveSchedule({ ...config, weekly }, professionalId).then(() => {
        showToast("Agenda configurada.");
        finish();
      });
    });

    overlay.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", finish));
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) finish();
    });
    document.body.appendChild(overlay);
    openModal(overlay);
  }

  // --------------------------------------------------------- Detail modal
  function openDetailModal(app: Appointment): void {
    const name = app.servicoNome ?? "-";
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div class="modal__header">
          <h2 class="modal__title" id="detail-title">Detalhes do agendamento</h2>
          <button type="button" class="modal__close" data-close aria-label="Fechar">${icon("x", 18)}</button>
        </div>
        <div class="modal__body">
          <div class="detail-status">${statusBadge(app.status)}</div>
          <dl class="detail-list">
            <div><dt>Cliente</dt><dd>${escapeHtml(app.clienteNome ?? "-")}</dd></div>
            <div><dt>Serviço</dt><dd>${escapeHtml(name)}</dd></div>
            <div><dt>Profissional</dt><dd>${escapeHtml(app.funcionarioNome ?? professionalName(app.funcionarioId) ?? "-")}</dd></div>
            <div><dt>Data</dt><dd>${formatDateMedium(app.data)}</dd></div>
            <div><dt>Horário</dt><dd>${app.hora}</dd></div>
            <div><dt>Total</dt><dd><strong class="detail-total">${formatCurrency(serviceTotal(app.servicoId))}</strong></dd></div>
            ${app.observacao ? `<div><dt>Observação</dt><dd>${escapeHtml(app.observacao)}</dd></div>` : ""}
          </dl>
          ${app.status === "cancelado" ? `<div class="alert alert--danger">Este agendamento foi cancelado.</div>` : ""}
          <div class="modal__footer">
            <button type="button" class="btn btn--ghost" data-close>Fechar</button>
          </div>
        </div>
      </div>
    `;
    const finish = (): void => {
      closeModal(overlay);
      window.setTimeout(() => overlay.remove(), 300);
    };
    overlay.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", finish));
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) finish();
    });
    document.body.appendChild(overlay);
    openModal(overlay);
  }

  // --------------------------------------------------------------- Serviços
  function renderServicos(): void {
    refreshCaches();
    const actionsHeader = isAdmin ? `<th>Ações</th>` : "";
    const actionsCell = (id: string): string =>
      isAdmin
        ? `<td><span class="cell-actions"><button type="button" class="btn btn--sm btn--ghost btn--ghost-gold" data-edit-service="${escapeHtml(id)}">Editar</button><button type="button" class="btn btn--sm btn--danger-outline" data-delete-service="${escapeHtml(id)}">Excluir</button></span></td>`
        : "";

    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">Serviços</h3>
          <p class="manage-head__sub">Gerencie os serviços oferecidos pelo salão</p>
        </div>
        ${isAdmin ? `
        <div class="toolbar">
          <button type="button" class="btn btn--primary" data-new-service>${icon("plus", 16)} Novo serviço</button>
        </div>` : ""}
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nome do Serviço</th>
              <th>Categoria</th>
              <th>Duração</th>
              <th>Preço</th>
              ${actionsHeader}
            </tr>
          </thead>
          <tbody>
            ${servicesCache
              .map(
                (s) => `
                  <tr>
                    <td><strong>${escapeHtml(s.name)}</strong></td>
                    <td>${escapeHtml(s.category || "-")}</td>
                    <td>${s.durationMin} min</td>
                    <td>${formatCurrency(s.price)}</td>
                    ${actionsCell(s.id)}
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>
        ${servicesCache.length === 0 ? `<p class="panel__empty">Nenhum serviço cadastrado.</p>` : ""}
      </div>
    `;

    const newBtn = $<HTMLButtonElement>("[data-new-service]", content);
    if (newBtn) {
      const h = (): void => openServiceModal(null);
      newBtn.addEventListener("click", h);
      cleanups.push(() => newBtn.removeEventListener("click", h));
    }

    $$("[data-edit-service]", content).forEach((btn) => {
      const id = btn.getAttribute("data-edit-service")!;
      const h = (): void => {
        const service = servicesCache.find((s) => s.id === id) ?? null;
        openServiceModal(service);
      };
      btn.addEventListener("click", h);
      cleanups.push(() => btn.removeEventListener("click", h));
    });

    $$("[data-delete-service]", content).forEach((btn) => {
      const id = btn.getAttribute("data-delete-service")!;
      const h = (): void => {
        const service = servicesCache.find((s) => s.id === id);
        if (!service) return;
        void handleDeleteService(service);
      };
      btn.addEventListener("click", h);
      cleanups.push(() => btn.removeEventListener("click", h));
    });
  }

  async function handleDeleteService(service: Service): Promise<void> {
    if (!isAdmin) return; // Recepcionista não altera serviços (PRD).
    const confirmed = await confirmDialog({
      title: "Excluir serviço",
      message: `Excluir o serviço "${service.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await setServicoStatus(service.id, false);
      showToast("Serviço removido.");
    } catch {
      showToast("Erro ao remover serviço.", "error");
    }
    renderServicos();
  }

  function openServiceModal(service: Service | null): void {
    if (!isAdmin) return; // Recepcionista não altera serviços (PRD).
    const isEdit = Boolean(service);
    const categories = loadCategories();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="modal modal--md" role="dialog" aria-modal="true" aria-labelledby="svc-modal-title">
        <div class="modal__header">
          <h2 class="modal__title" id="svc-modal-title">${isEdit ? "Editar serviço" : "Novo serviço"}</h2>
          <button type="button" class="modal__close" data-close aria-label="Fechar">${icon("x", 18)}</button>
        </div>
        <form class="modal__body" id="svc-form" novalidate>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="svc-name">Nome *</label>
              <input type="text" id="svc-name" value="${escapeHtml(service?.name ?? "")}" maxlength="60" required>
              <span class="field__error">Informe o nome.</span>
            </div>
            <div class="field">
              <label class="field__label" for="svc-category">Categoria</label>
              <input type="text" id="svc-category" list="svc-categories" value="${escapeHtml(service?.category ?? "")}" maxlength="30">
              <datalist id="svc-categories">
                ${categories.map((c) => `<option value="${escapeHtml(c)}">`).join("")}
              </datalist>
              <span class="field__hint">Digite um nome novo para adicionar categoria</span>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="svc-duration">Duração (min) *</label>
              <input type="number" id="svc-duration" value="${service?.durationMin ?? 30}" min="10" step="5" required>
            </div>
            <div class="field">
              <label class="field__label" for="svc-price">Preço (R$) *</label>
              <input type="number" id="svc-price" value="${service?.price ?? 0}" min="0" step="0.5" required>
            </div>
            <div class="field">
              <label class="field__label" for="svc-icon">Ícone</label>
              <select id="svc-icon">
                ${SERVICE_ICONS.map(
                  (o) => `<option value="${o.value}" ${service?.icon === o.value ? "selected" : ""}>${o.label}</option>`,
                ).join("")}
              </select>
            </div>
          </div>
          <div class="modal__footer">
            <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn--primary">${isEdit ? "Salvar" : "Criar serviço"}</button>
          </div>
        </form>
      </div>
    `;

    const form = overlay.querySelector<HTMLFormElement>("#svc-form")!;
    const finish = (): void => {
      closeModal(overlay);
      window.setTimeout(() => overlay.remove(), 300);
    };

    const submitHandler = async (event: Event): Promise<void> => {
      event.preventDefault();
      const name = ($("#svc-name", overlay) as HTMLInputElement).value.trim();
      const duration = Number(($("#svc-duration", overlay) as HTMLInputElement).value);
      const price = Number(($("#svc-price", overlay) as HTMLInputElement).value);
      if (name.length < 3) {
        showToast("Informe o nome do serviço.", "error");
        return;
      }
      if (!Number.isFinite(duration) || duration < 10 || !Number.isFinite(price) || price < 0) {
        showToast("Verifique duração e preço.", "error");
        return;
      }
      const category = ($("#svc-category", overlay) as HTMLInputElement).value.trim();
      const iconSel = ($("#svc-icon", overlay) as HTMLSelectElement).value as ServiceIcon;
      const description = service?.description ?? "";
      if (category && !loadCategories().includes(category)) {
        saveCategories([...loadCategories(), category]);
      }
      try {
        if (isEdit && service) {
          await updateServico(service.id, { name, description, durationMin: duration, price });
          showToast("Serviço atualizado.");
        } else {
          await createServico({ name, description, durationMin: duration, price });
          showToast("Serviço criado!");
        }
        // PENDÊNCIA: icon e category são campos frontend-only; o backend não os persiste.
        void iconSel;
        void category;
        finish();
        renderServicos();
      } catch {
        showToast("Erro ao salvar serviço. Verifique os dados.", "error");
      }
    };

    form.addEventListener("submit", submitHandler);
    overlay.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", finish));
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) finish();
    });
    document.body.appendChild(overlay);
    openModal(overlay);
  }

  // ----------------------------------------------------------- Profissionais
  async function renderProfissionais(): Promise<void> {
    refreshCaches();
    const appts = await listAppointments();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const counts = new Map<string, number>();
    for (const a of appts) {
      if (a.status === "cancelado" || !a.data.startsWith(monthStart)) continue;
      counts.set(a.funcionarioId, (counts.get(a.funcionarioId) ?? 0) + 1);
    }
    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">Profissionais</h3>
          <p class="manage-head__sub">Equipe do salão e acessos de login</p>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn--primary" data-new-pro>${icon("plus", 16)} Adicionar novo</button>
        </div>
      </div>
      <div class="pro-grid" id="manage-pros-list">
        ${prosCache
          .map(
            (p) => `
              <div class="pro-card">
                <div class="pro-card__head">
                  <span class="avatar">${initials(p.name)}</span>
                  <div class="pro-card__meta">
                    <strong>${escapeHtml(p.name)}</strong>
                    <span class="pro-card__role">${escapeHtml(p.role)}</span>
                  </div>
                </div>
                <div class="pro-card__metric">${icon("calendar", 16)} <span>Agendamentos este mês: <strong>${counts.get(p.id) ?? 0}</strong></span></div>
                <div class="pro-card__actions">
                  <button type="button" class="btn btn--sm btn--ghost btn--ghost-gold" data-edit-pro="${escapeHtml(p.id)}">Editar</button>
                  <button type="button" class="btn btn--sm btn--danger-outline" data-del-pro="${escapeHtml(p.id)}">Excluir</button>
                </div>
              </div>`,
          )
          .join("")}
        ${prosCache.length === 0 ? `<p class="panel__empty">Nenhum profissional cadastrado.</p>` : ""}
      </div>
    `;

    const newBtn = $<HTMLButtonElement>("[data-new-pro]", content);
    if (newBtn) {
      const h = (): void => {
        void openProModal(null);
      };
      newBtn.addEventListener("click", h);
      cleanups.push(() => newBtn.removeEventListener("click", h));
    }

    $$("[data-edit-pro]", content).forEach((btn) => {
      const id = btn.getAttribute("data-edit-pro")!;
      const h = (): void => {
        const pro = prosCache.find((p) => p.id === id) ?? null;
        void openProModal(pro);
      };
      btn.addEventListener("click", h);
      cleanups.push(() => btn.removeEventListener("click", h));
    });

    $$("[data-del-pro]", content).forEach((btn) => {
      const id = btn.getAttribute("data-del-pro")!;
      const h = (): void => {
        void handleDeletePro(id);
      };
      btn.addEventListener("click", h);
      cleanups.push(() => btn.removeEventListener("click", h));
    });
  }

  async function handleDeletePro(id: string): Promise<void> {
    const pro = prosCache.find((p) => p.id === id);
    const confirmed = await confirmDialog({
      title: "Excluir profissional",
      message: `Excluir ${pro?.name ?? "o profissional"}? O login vinculado também será removido.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!confirmed) return;
    try {
      const usuario = await findByProfessionalId(id);
      if (usuario) await deleteUsuarioInterno(usuario.id);
      showToast("Profissional excluído.");
    } catch {
      showToast("Erro ao excluir profissional.", "error");
    }
    await renderProfissionais();
  }

  async function openProModal(pro: Professional | null): Promise<void> {
    const isEdit = Boolean(pro);
    const categories = loadCategories();
    const usuario = pro ? await findByProfessionalId(pro.id) : null;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="modal modal--md" role="dialog" aria-modal="true" aria-labelledby="pro-modal-title">
        <div class="modal__header">
          <h2 class="modal__title" id="pro-modal-title">${isEdit ? "Editar profissional" : "Novo profissional"}</h2>
          <button type="button" class="modal__close" data-close aria-label="Fechar">${icon("x", 18)}</button>
        </div>
        <form class="modal__body" id="pro-form" novalidate>
          <div class="field">
            <label class="field__label" for="pro-name">Nome completo *</label>
            <input type="text" id="pro-name" value="${escapeHtml(pro?.name ?? "")}" maxlength="80" required>
            <span class="field__error">Informe o nome.</span>
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="pro-role">Cargo / Função *</label>
              <input type="text" id="pro-role" value="${escapeHtml(pro?.role ?? "")}" maxlength="40" placeholder="Ex.: Barbeiro">
            </div>
            <div class="field">
              <label class="field__label" for="pro-category">Categoria</label>
              <select id="pro-category">
                <option value="">Selecione...</option>
                ${categories.map((c) => `<option value="${escapeHtml(c)}" ${pro?.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="pro-email">Email (login) *</label>
            <input type="email" id="pro-email" value="${escapeHtml(usuario?.email ?? pro?.email ?? "")}" ${isEdit && usuario ? "readonly" : ""} maxlength="100" autocapitalize="none" spellcheck="false" required>
            <span class="field__hint">${isEdit && usuario ? "Login existente. Para alterar o e-mail, use as Configurações." : "Cria o acesso de login deste profissional."}</span>
          </div>
          <div class="modal__footer">
            <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn--primary">${isEdit ? "Salvar" : "Cadastrar"}</button>
          </div>
        </form>
      </div>
    `;

    const form = overlay.querySelector<HTMLFormElement>("#pro-form")!;
    const finish = (): void => {
      closeModal(overlay);
      window.setTimeout(() => overlay.remove(), 300);
    };

    const submitHandler = async (event: Event): Promise<void> => {
      event.preventDefault();
      const name = ($("#pro-name", overlay) as HTMLInputElement).value.trim();
      const email = ($("#pro-email", overlay) as HTMLInputElement).value.trim().toLowerCase();
      const role = ($("#pro-role", overlay) as HTMLInputElement).value.trim();

      if (name.length < 3) {
        showToast("Informe o nome.", "error");
        return;
      }
      if (role.length === 0) {
        showToast("Informe o cargo/função.", "error");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        showToast("Informe um e-mail válido.", "error");
        return;
      }
      const existing = await findUsuarioByEmail(email);
      if (!isEdit && existing) {
        showToast("Já existe um usuário com este e-mail.", "error");
        return;
      }

      if (isEdit && pro) {
        try {
          const existing = await findByProfessionalId(pro.id);
          if (existing) {
            // PUT /funcionarios aceita nome, cargo, especialidade, email e senha.
            // role é o `cargo` do backend (barbeiro/recepcionista/administrador).
            const cargo: "barbeiro" | "recepcionista" | "administrador" =
              role.toLowerCase().includes("recepcion") ? "recepcionista" : "barbeiro";
            await updateUsuarioInterno(existing.id, {
              nome: name,
              cargo,
              especialidade: role,
            });
          }
          showToast("Profissional atualizado.");
        } catch {
          showToast("Erro ao atualizar profissional.", "error");
        }
        finish();
        await renderProfissionais();
        return;
      }

      // Novo profissional: cria funcionário via API e atualiza o cache local.
      try {
        await createUsuarioInterno({
          nome: name,
          email,
          senha: CONFIG.defaultPassword,
          role: "profissional",
        });
        showToast(`Profissional cadastrado! Senha padrão: ${CONFIG.defaultPassword}. Altere em Configurações.`, "success");
        finish();
        await renderProfissionais();
      } catch {
        showToast("Não foi possível cadastrar o profissional. Verifique se o e-mail já está em uso.", "error");
      }
    };

    form.addEventListener("submit", submitHandler);
    overlay.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", finish));
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) finish();
    });
    document.body.appendChild(overlay);
    openModal(overlay);
  }

  // ---------------------------------------------------------- Configurações
  function renderConfiguracoes(): void {
    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">Configurações</h3>
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

  // ----------------------------------------------------------- Tab routing
  const linkHandler = (): void => {
    const path = window.location.hash.slice(1);
    if (path === `${base}/agendamentos`) handleTab("agendamentos");
    else if (path === `${base}/servicos`) handleTab("servicos");
    else if (path === `${base}/profissionais`) handleTab("profissionais");
    else if (path === `${base}/configuracoes`) handleTab("configuracoes");
    else handleTab(isAdmin ? "dashboard" : "agendamentos");
  };
  linkHandler();
  window.addEventListener("hashchange", linkHandler);
  cleanups.push(() => window.removeEventListener("hashchange", linkHandler));

  return () => {
    cleanups.forEach((fn) => fn());
    cleanupPanel();
  };
}

const SERVICE_ICONS: Array<{ value: ServiceIcon; label: string }> = [
  { value: "scissors", label: "Tesoura" },
  { value: "beard", label: "Barba" },
  { value: "layers", label: "Camadas" },
  { value: "sparkle", label: "Estrela" },
];
