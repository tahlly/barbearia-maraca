import { renderPanel } from "../ui/layout.js";
import { requireRole, updateSessionUser } from "../services/auth.js";
import { $, escapeHtml, initials } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { formatDateMedium } from "../ui/format.js";
import { listAppointments } from "../services/booking.js";
import { showToast } from "../ui/toast.js";
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

  type ManageTab = "agendamentos" | "configuracoes";

  const base = "/profissional";

  function handleTab(tab: ManageTab): void {
    if (tab === "agendamentos") renderAgendamentos();
    else renderConfiguracoes();
  }

  // ------------------------------------------------------ Estado de erro da lista
  let appointmentsError: string | null = null;

  async function fetchAppointments(): Promise<Appointment[]> {
    try {
      const list = await listAppointments();
      appointmentsError = null;
      return list;
    } catch (error) {
      appointmentsError =
        error instanceof Error ? error.message : "Não foi possível carregar os agendamentos.";
      return [];
    }
  }

  function renderAppointmentsError(): void {
    const table = $("#pro-agenda-table", content);
    if (table && appointmentsError) {
      table.innerHTML = `<p class="panel__empty" role="alert">${escapeHtml(appointmentsError)}</p>`;
    }
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
      let list = appointments;
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

    async function reloadList(): Promise<void> {
      const list = await fetchAppointments();
      if (appointmentsError) renderAppointmentsError();
      else refresh(list);
    }

    void reloadList();

    const onSearch = (): void => {
      void reloadList();
    };
    const onFilter = (): void => {
      void reloadList();
    };
    const onConsult = (): void => {
      void reloadList();
    };

    const onClear = (): void => {
      if (inicio) inicio.value = defaultStart;
      if (fim) fim.value = defaultEnd;
      if (search) search.value = "";
      if (filter) filter.value = "todos";
      void reloadList();
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
      <div class="config-card">
        <div class="config-photo">
          <span class="avatar avatar--lg">${initials(session?.userName ?? "?")}</span>
          <input type="file" id="profile-photo" accept="image/*" hidden>
          <button type="button" class="btn btn--sm btn--gold-outline" id="profile-photo-btn">${icon("upload", 14)} Carregar foto</button>
        </div>

        <form id="profile-form" novalidate>
          <div class="field">
            <label class="field__label" for="profile-name">Nome</label>
            <input type="text" id="profile-name" value="${escapeHtml(session?.userName ?? "")}" maxlength="80">
          </div>

          <h4 class="manage-form-title">Alterar Senha</h4>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="pw-current">Senha atual</label>
              <input type="password" id="pw-current" autocomplete="current-password">
            </div>
            <div class="field">
              <label class="field__label" for="pw-new">Nova senha</label>
              <input type="password" id="pw-new" autocomplete="new-password">
            </div>
            <div class="field">
              <label class="field__label" for="pw-confirm">Confirmar nova senha</label>
              <input type="password" id="pw-confirm" autocomplete="new-password">
            </div>
          </div>

          <h4 class="manage-form-title">Alterar Email de Acesso</h4>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="email-current">Email atual</label>
              <input type="password" id="email-current" autocomplete="current-password">
            </div>
            <div class="field">
              <label class="field__label" for="email-new">Novo email</label>
              <input type="email" id="email-new" value="${escapeHtml(session?.userEmail ?? "")}" autocapitalize="none" spellcheck="false">
            </div>
            <div class="field">
              <label class="field__label" for="email-confirm">Confirmar novo email</label>
              <input type="email" id="email-confirm" autocapitalize="none" spellcheck="false">
            </div>
          </div>

          <div class="config-actions">
            <button type="button" class="btn btn--danger" data-profile-cancel>Cancelar</button>
            <button type="submit" class="btn btn--success">Salvar alterações</button>
          </div>
        </form>
      </div>
    `;

    const photoBtn = $<HTMLButtonElement>("#profile-photo-btn", content);
    const photoInput = $<HTMLInputElement>("#profile-photo", content);
    const avatar = $<HTMLElement>(".config-photo .avatar", content);
    if (photoBtn && photoInput && avatar) {
      const click = (): void => photoInput.click();
      photoBtn.addEventListener("click", click);
      cleanups.push(() => photoBtn.removeEventListener("click", click));

      photoInput.addEventListener("change", () => {
        const file = photoInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          sessionStorage.setItem("maraca.profilePhoto", dataUrl);
          avatar.style.backgroundImage = `url("${dataUrl}")`;
          avatar.textContent = "";
          showToast("Foto atualizada.");
        };
        reader.readAsDataURL(file);
      });

      const savedPhoto = sessionStorage.getItem("maraca.profilePhoto");
      if (savedPhoto) {
        avatar.style.backgroundImage = `url("${savedPhoto}")`;
        avatar.textContent = "";
      }
    }

    const form = $<HTMLFormElement>("#profile-form", content);
    if (form) {
      const cancelBtn = $<HTMLButtonElement>("[data-profile-cancel]", content);
      if (cancelBtn) {
        const cancel = (): void => {
          const nameInput = $("#profile-name", content) as HTMLInputElement;
          nameInput.value = session?.userName ?? "";
          ($("#email-new", content) as HTMLInputElement).value = session?.userEmail ?? "";
          (form.querySelectorAll('input[type="password"]') as NodeListOf<HTMLInputElement>).forEach((i) => {
            i.value = "";
          });
          ($("#email-confirm", content) as HTMLInputElement).value = "";
          showToast("Alterações descartadas.");
        };
        cancelBtn.addEventListener("click", cancel);
        cleanups.push(() => cancelBtn.removeEventListener("click", cancel));
      }

      const submit = (event: Event): void => {
        event.preventDefault();
        const nome = ($("#profile-name", content) as HTMLInputElement).value.trim();
        const pwCurrent = ($("#pw-current", content) as HTMLInputElement).value;
        const pwNew = ($("#pw-new", content) as HTMLInputElement).value;
        const pwConfirm = ($("#pw-confirm", content) as HTMLInputElement).value;
        const emailPw = ($("#email-current", content) as HTMLInputElement).value;
        const emailNew = ($("#email-new", content) as HTMLInputElement).value.trim().toLowerCase();
        const emailConfirm = ($("#email-confirm", content) as HTMLInputElement).value.trim().toLowerCase();

        const wantsPassword = pwCurrent !== "" || pwNew !== "" || pwConfirm !== "";
        const emailChanged = emailNew !== (session?.userEmail ?? "");
        const wantsEmail = emailChanged || emailConfirm !== "";

        if (nome.length === 0) {
          showToast("Informe um nome válido.", "error");
          return;
        }
        if (wantsPassword && pwNew !== pwConfirm) {
          showToast("As novas senhas não coincidem.", "error");
          return;
        }
        if (wantsPassword && (pwCurrent === "" || pwNew.length === 0)) {
          showToast("Preencha senha atual e nova senha.", "error");
          return;
        }
        if (wantsEmail) {
          if (emailPw === "") {
            showToast("Informe a senha atual para alterar o e-mail.", "error");
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailNew) || emailNew !== emailConfirm) {
            showToast("Verifique o novo e-mail e a confirmação.", "error");
            return;
          }
        }

        const data: { nome?: string; email?: string; senhaAtual?: string; novaSenha?: string } = { nome };
        if (wantsPassword) {
          data.senhaAtual = pwCurrent;
          data.novaSenha = pwNew;
        }
        if (wantsEmail) {
          data.email = emailNew;
        }

        void (async () => {
          const result = await updateSessionUser(data);
          if (!result.ok) {
            showToast(result.message ?? "Não foi possível salvar.", "error");
            return;
          }
          showToast("Alterações salvas.");
          renderConfiguracoes();
        })();
      };
      form.addEventListener("submit", submit);
      cleanups.push(() => form.removeEventListener("submit", submit));
    }
  }

  // ------------------------------------------------------------ Tab routing
  const linkHandler = (): void => {
    const path = window.location.hash.slice(1);
    if (path === `${base}/configuracoes`) handleTab("configuracoes");
    else handleTab("agendamentos");
  };

  // O filtro por professionalId foi removido: o backend já restringe
  // listAppointments() aos agendamentos do próprio barbeiro.
  linkHandler();

  window.addEventListener("hashchange", linkHandler);
  cleanups.push(() => window.removeEventListener("hashchange", linkHandler));

  return () => {
    cleanups.forEach((fn) => fn());
    cleanupPanel();
  };
}
