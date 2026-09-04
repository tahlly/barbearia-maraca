import { renderPanel } from "../ui/layout.js";
import { requireRole, updateSessionUser } from "../services/auth.js";
import { $, escapeHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { formatDateMedium } from "../ui/format.js";
import { listAppointments } from "../services/booking.js";
import { listUsuariosInternos } from "../services/usuarios.js";
import { showToast } from "../ui/toast.js";
import { renderSettingsForm } from "../features/settingsForm.js";
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

export function renderProfissional(container: HTMLElement): () => void {
  const session = requireRole(["profissional"]);
  const { content, cleanup: cleanupPanel } = renderPanel(container, {
    title: "Minha Agenda",
    roleLabel: "Profissional",
    links: [
      { href: "#/profissional", label: "Agendamentos", icon: "calendar" },
      { href: "#/profissional/configuracoes", label: "Configurações", icon: "cog" },
      { href: "#/", label: "Voltar ao site", icon: "arrow-left" },
    ],
  });

  const cleanups: Array<() => void> = [];

  let professionalId = "";

  type ManageTab = "agendamentos" | "configuracoes";

  const base = "/profissional";

  function handleTab(tab: ManageTab): void {
    if (tab === "agendamentos") renderAgendamentos();
    else renderConfiguracoes();
  }

  // ------------------------------------------------------------ Agendamentos
  function renderAgendamentos(): void {
    const currentYear = new Date().getFullYear();
    const defaultStart = `${currentYear}-01-01`;
    const defaultEnd = `${currentYear}-12-31`;

    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">MEUS AGENDAMENTOS</h3>
          <p class="manage-head__sub">Controle completo da agenda do salão e status das reservas</p>
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
            <input type="search" data-search-app placeholder="Buscar cliente..." aria-label="Buscar cliente">
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
            <button type="button" class="btn adv-filter__consult" data-consult>Consultar</button>
            <button type="button" class="btn adv-filter__clear" data-clear-filter>Limpar Filtro</button>
          </div>
        </div>
      </div>

      <div class="table-wrap" id="pro-agenda-table">
        <p class="panel__empty">Carregando agendamentos...</p>
      </div>
    `;

    const search = $<HTMLInputElement>("[data-search-app]", content);
    const filter = $<HTMLSelectElement>("[data-status-filter]", content);
    const inicio = $<HTMLInputElement>("[data-inicio]", content);
    const fim = $<HTMLInputElement>("[data-fim]", content);

    if (inicio) inicio.value = defaultStart;
    if (fim) fim.value = defaultEnd;

    function applyFilters(appointments: Appointment[]): Appointment[] {
      let list = appointments.filter((a) => a.funcionarioId === professionalId);
      const q = (search?.value ?? "").trim().toLowerCase();
      if (q) {
        list = list.filter(
          (a) => (a.clienteNome ?? "").toLowerCase().includes(q) || (a.clienteId ?? "").toLowerCase().includes(q),
        );
      }
      const status = filter?.value ?? "todos";
      if (status !== "todos") list = list.filter((a) => a.status === status);
      const ini = inicio?.value;
      const fimv = fim?.value;
      if (ini) list = list.filter((a) => a.data >= ini);
      if (fimv) list = list.filter((a) => a.data <= fimv);
      return [...list].sort((a, b) => {
        const ka = `${a.data}T${a.hora}`;
        const kb = `${b.data}T${b.hora}`;
        return kb.toString().localeCompare(ka.toString());
      });
    }

    function refresh(appointments: Appointment[]): void {
      $("#pro-agenda-table", content)!.innerHTML = buildTable(applyFilters(appointments));
    }

    void (async () => {
      const appointments = await listAppointments();
      refresh(appointments);
    })();

    const onSearch = (): void => {
      void (async () => refresh(await listAppointments()))();
    };
    const onFilter = (): void => {
      void (async () => refresh(await listAppointments()))();
    };
    const onConsult = (): void => {
      void (async () => refresh(await listAppointments()))();
    };

    const onClear = (): void => {
      if (inicio) inicio.value = defaultStart;
      if (fim) fim.value = defaultEnd;
      if (search) search.value = "";
      if (filter) filter.value = "todos";
      void (async () => refresh(await listAppointments()))();
    };

    search?.addEventListener("input", onSearch);
    filter?.addEventListener("change", onFilter);
    $<HTMLButtonElement>("[data-consult]", content)?.addEventListener("click", onConsult);
    $<HTMLButtonElement>("[data-clear-filter]", content)?.addEventListener("click", onClear);

    cleanups.push(() => search?.removeEventListener("input", onSearch));
    cleanups.push(() => filter?.removeEventListener("change", onFilter));
  }

  function buildTable(appointments: Appointment[]): string {
    if (appointments.length === 0) {
      return `<p class="panel__empty">Nenhum agendamento encontrado.</p>`;
    }
    return `
      <table class="table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Data/Hora</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${appointments
            .map((a) => {
              const name = a.servicoNome ?? "-";
              return `
                <tr>
                  <td><strong>${escapeHtml(a.clienteNome ?? "-")}</strong></td>
                  <td>${escapeHtml(name)}</td>
                  <td>${formatDateMedium(a.data)} · ${a.hora}</td>
                  <td>${statusBadge(a.status)}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  // ----------------------------------------------------------- Configurações
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

  // ------------------------------------------------------------ Tab routing
  const linkHandler = (): void => {
    const path = window.location.hash.slice(1);
    if (path === `${base}/configuracoes`) handleTab("configuracoes");
    else handleTab("agendamentos");
  };

  // Resolve o professionalId do usuário logado antes de renderizar.
  void (async () => {
    const usuarios = await listUsuariosInternos();
    const usuarioLogado =
      usuarios.find(
        (u) => u.email.toLowerCase() === (session?.userEmail ?? "").toLowerCase(),
      ) ?? null;
    professionalId = usuarioLogado?.professionalId ?? "";
    linkHandler();
  })();

  window.addEventListener("hashchange", linkHandler);
  cleanups.push(() => window.removeEventListener("hashchange", linkHandler));

  return () => {
    cleanups.forEach((fn) => fn());
    cleanupPanel();
  };
}
