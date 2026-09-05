import { renderPanel } from "../ui/layout.js";
import { requireRole, getSession, updateSessionUser } from "../services/auth.js";
import { $, escapeHtml, initials } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { formatDateMedium } from "../ui/format.js";
import { loadServices, loadProfessionals, saveProfessionals } from "../services/catalog.js";
import { loadAllAppointments } from "../services/booking.js";
import { listUsuariosInternos, updateUsuarioInterno } from "../services/usuarios.js";
import { showToast } from "../ui/toast.js";
import type { Appointment, Service, Professional } from "../types.js";

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

  const usuarioLogado = listUsuariosInternos().find(
    (u) => u.email.toLowerCase() === (session?.userEmail ?? "").toLowerCase(),
  );
  const professionalId = usuarioLogado?.professionalId ?? "";

  let servicesCache: Service[] = loadServices();
  let prosCache: Professional[] = loadProfessionals();

  function serviceName(id: string): string {
    return servicesCache.find((s) => s.id === id)?.name ?? "-";
  }

  function professionalName(id: string): string {
    return prosCache.find((p) => p.id === id)?.name ?? "-";
  }

  type ManageTab = "agendamentos" | "configuracoes";

  const base = "/profissional";

  function handleTab(tab: ManageTab): void {
    if (tab === "agendamentos") renderAgendamentos();
    else renderConfiguracoes();
  }

  // ------------------------------------------------------------ Agendamentos
  function renderAgendamentos(): void {
    servicesCache = loadServices();
    prosCache = loadProfessionals();

    const appointments = loadAllAppointments()
      .filter((a) => a.professionalId === professionalId)
      .sort((a, b) => {
        const ka = `${a.dateIso}T${a.time}`;
        const kb = `${b.dateIso}T${b.time}`;
        return kb.toString().localeCompare(ka.toString());
      });

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
        ${buildTable(appointments)}
      </div>
    `;

    const search = $<HTMLInputElement>("[data-search-app]", content);
    const filter = $<HTMLSelectElement>("[data-status-filter]", content);
    const inicio = $<HTMLInputElement>("[data-inicio]", content);
    const fim = $<HTMLInputElement>("[data-fim]", content);

    // Por padrão, mostra apenas os agendamentos do profissional logado.
    if (inicio) inicio.value = defaultStart;
    if (fim) fim.value = defaultEnd;

    function rows(): Appointment[] {
      return loadAllAppointments()
        .filter((a) => a.professionalId === professionalId)
        .sort((a, b) => {
          const ka = `${a.dateIso}T${a.time}`;
          const kb = `${b.dateIso}T${b.time}`;
          return kb.toString().localeCompare(ka.toString());
        });
    }

    function applySearch(): Appointment[] {
      const q = (search?.value ?? "").trim().toLowerCase();
      let list = rows();
      if (q) {
        list = list.filter((a) => a.clientName.toLowerCase().includes(q) || a.phone.includes(q));
      }
      return list;
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
        if (ini && a.dateIso < ini) return false;
        if (fimv && a.dateIso > fimv) return false;
        return true;
      });
    }

    function refresh(): void {
      let list = applySearch();
      list = applyStatus(list);
      list = applyDates(list);
      $("#pro-agenda-table", content)!.innerHTML = buildTable(list);
    }

    const onSearch = (): void => refresh();
    const onFilter = (): void => refresh();

    const onConsult = (): void => refresh();

    const onClear = (): void => {
      if (inicio) inicio.value = defaultStart;
      if (fim) fim.value = defaultEnd;
      if (search) search.value = "";
      if (filter) filter.value = "todos";
      refresh();
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
            <th>Telefone</th>
            <th>Profissional</th>
            <th>Serviço</th>
            <th>Data/Hora</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${appointments
            .map((a) => {
              const names =
                a.serviceIds.map((id) => serviceName(id)).filter((n) => n !== "-").join(", ") || "-";
              return `
                <tr>
                  <td><strong>${escapeHtml(a.clientName)}</strong></td>
                  <td>${escapeHtml(a.phone)}</td>
                  <td>${escapeHtml(professionalName(a.professionalId))}</td>
                  <td>${escapeHtml(names)}</td>
                  <td>${formatDateMedium(a.dateIso)} · ${a.time}</td>
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
    const current = getSession();
    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">CONFIGURAÇÕES</h3>
          <p class="manage-head__sub">Segurança e dados do usuário</p>
        </div>
      </div>
      <div class="config-card">
        <div class="config-photo">
          <span class="avatar avatar--lg">${initials(current?.userName ?? "?")}</span>
          <input type="file" id="profile-photo" accept="image/*" hidden>
          <button type="button" class="btn btn--sm btn--gold-outline" id="profile-photo-btn">${icon("upload", 14)} Carregar foto</button>
        </div>

        <form id="profile-form" novalidate>
          <div class="field">
            <label class="field__label" for="profile-name">Nome</label>
            <input type="text" id="profile-name" value="${escapeHtml(current?.userName ?? "")}" maxlength="80">
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
              <input type="email" id="email-new" value="${escapeHtml(current?.userEmail ?? "")}" autocapitalize="none" spellcheck="false">
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
          if (professionalId) {
            const pros = loadProfessionals().map((p) =>
              p.id === professionalId ? { ...p, photoUrl: dataUrl } : p,
            );
            saveProfessionals(pros);
            prosCache = pros;
          }
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
          const s = getSession();
          const nameInput = $("#profile-name", content) as HTMLInputElement;
          nameInput.value = s?.userName ?? "";
          ($("#email-new", content) as HTMLInputElement).value = s?.userEmail ?? "";
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
        const emailChanged = emailNew !== (current?.userEmail ?? "");
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
          if (wantsPassword && usuarioLogado) {
            updateUsuarioInterno(usuarioLogado.id, { senha: pwNew });
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
  linkHandler();
  window.addEventListener("hashchange", linkHandler);
  cleanups.push(() => window.removeEventListener("hashchange", linkHandler));

  return () => {
    cleanups.forEach((fn) => fn());
    cleanupPanel();
  };
}
