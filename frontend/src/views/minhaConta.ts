import { renderPanel } from "../ui/layout.js";
import { requireRole, updateSessionUser } from "../services/auth.js";
import { $, $$, escapeHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { formatCurrency, formatDateMedium } from "../ui/format.js";
import { fetchServices, loadProfessionals } from "../services/catalog.js";
import { listAppointments, cancelAppointment } from "../services/booking.js";
import { createCardPayment, createPayment, type PagamentoDTO } from "../services/pagamento.js";
import { pagamentoAcoesHtml } from "../features/pagamentoAcoes.js";
import { showToast } from "../ui/toast.js";
import { closeModal, confirmDialog, openModal } from "../ui/modal.js";
import { montarCardPaymentBrick } from "../features/cardPaymentBrick.js";
import { CONFIG } from "../config.js";
import { initBookingWizard } from "../features/bookingWizard.js";
import { renderSettingsForm } from "../features/settingsForm.js";
import { contactSectionHtml } from "../features/contactSection.js";
import { dependentesDialog } from "../features/dependentesDialog.js";
import {
  bindPaginacao,
  criarPaginacaoEstado,
  limitarPagina,
  paginar,
  paginacaoHtml,
  type PaginacaoEstado,
} from "../ui/pagination.js";
import {
  atualizarDependente,
  criarDependente,
  excluirDependente,
  listarDependentes,
  PARENTESCO_LABEL,
} from "../services/dependentesService.js";
import type { Appointment, Dependente, Professional, Service } from "../types.js";

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
    roleLabel: "CLIENTE",
    links: [
      { href: "#/minha-conta", label: "Agendamentos", icon: "calendar" },
      { href: "#/minha-conta/servicos", label: "Serviços Ofertados", icon: "scissors" },
      { href: "#/minha-conta/contatos", label: "Contatos", icon: "phone" },
      { href: "#/minha-conta/dependentes", label: "Dependentes", icon: "users" },
      { href: "#/minha-conta/configuracoes", label: "Configurações", icon: "cog" },
    ],
  });

  const wizard = initBookingWizard({ onBookingCreated: () => renderAgendamentos() });
  const cleanups: Array<() => void> = [];

  let prosCache: Professional[] = loadProfessionals();

  function professionalName(id: string): string {
    return prosCache.find((p) => p.id === id)?.name ?? "-";
  }

  type ManageTab = "agendamentos" | "servicos" | "contatos" | "dependentes" | "configuracoes";

  const base = "/minha-conta";

  function handleTab(tab: ManageTab): void {
    if (tab === "agendamentos") renderAgendamentos();
    else if (tab === "servicos") renderServicos();
    else if (tab === "contatos") renderContatos();
    else if (tab === "dependentes") renderDependentes();
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
    const table = $("#conta-agenda-table", content);
    if (table && appointmentsError) {
      table.innerHTML = `<p class="panel__empty" role="alert">${escapeHtml(appointmentsError)}</p>`;
    }
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
          <select class="input uppercase" data-status-filter aria-label="Filtrar por status">
            <option value="todos">Todos Status</option>
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <div class="manage-search">
            ${icon("search", 16)}
            <input type="search" class="uppercase" data-search-app placeholder="Buscar por serviço..." aria-label="Buscar por serviço">
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

    // Paginação client-side: estado local da tela; nova consulta reseta para a
    // primeira página. `ultimaLista` conserva os dados completos para os
    // handlers de navegação reaplicarem os filtros sem novo fetch.
    const paginacao = criarPaginacaoEstado();
    let ultimaLista: Appointment[] = [];
    let totalFiltrado = 0;

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
      ultimaLista = list;
      let filtered = applySearch(list);
      filtered = applyStatus(filtered);
      filtered = applyDates(filtered);
      // Paginação: limita a página ao novo total filtrado e renderiza a fatia.
      totalFiltrado = filtered.length;
      paginacao.paginaAtual = limitarPagina(paginacao.paginaAtual, filtered.length, paginacao.itensPorPagina);
      const pagina = paginar(filtered, paginacao);
      $("#conta-agenda-table", content)!.innerHTML = buildTable(pagina, filtered.length, paginacao);
      bindRows(pagina);
    }

    async function reloadList(): Promise<void> {
      const list = await fetchAppointments();
      if (appointmentsError) renderAppointmentsError();
      else refresh(list);
    }

    const onSearch = (): void => {
      paginacao.paginaAtual = 1;
      void reloadList();
    };
    const onFilter = (): void => {
      paginacao.paginaAtual = 1;
      void reloadList();
    };

    const onClear = (): void => {
      if (inicio) inicio.value = defaultStart;
      if (fim) fim.value = defaultEnd;
      if (search) search.value = "";
      if (filter) filter.value = "todos";
      paginacao.paginaAtual = 1;
      void reloadList();
    };

    search?.addEventListener("input", onSearch);
    filter?.addEventListener("change", onFilter);
    $<HTMLButtonElement>("[data-clear-filter]", content)?.addEventListener("click", onClear);
    $<HTMLButtonElement>("[data-new-booking]", content)?.addEventListener("click", () => wizard.openNew());

    cleanups.push(() => search?.removeEventListener("input", onSearch));
    cleanups.push(() => filter?.removeEventListener("change", onFilter));

    // Controles de paginação (delegação única por renderização): ao navegar,
    // reaplica os filtros sobre a última lista carregada sem novo fetch.
    const cleanupPag = bindPaginacao(content, paginacao, () => totalFiltrado, () => refresh(ultimaLista));
    cleanups.push(cleanupPag);

    void reloadList();
  }

  function buildTable(appointments: Appointment[], total: number, paginacao: PaginacaoEstado): string {
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
                // Ações da linha em `pagamentoAcoesHtml` (função pura):
                // badge para pagamento aprovado/cancelado, botão PAGAR
                // apenas para agendamento pendente sem pagamento concluído,
                // e REAGENDAR/Cancelar sempre disponíveis.
                actions = pagamentoAcoesHtml(a);
              }
              return `
                <tr>
                  <td><strong>${escapeHtml(name)}</strong></td>
                  <td>${escapeHtml(a.funcionarioNome ?? professionalName(a.funcionarioId))}</td>
                  <td>${formatDateMedium(a.data)} · ${a.hora}</td>
                  <td><span class="status-badges">${statusBadge(a.status)}</span></td>
                  <td>${actions}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
      ${paginacaoHtml(total, paginacao)}
    `;
  }

  function bindRows(appointments: Appointment[]): void {
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

    $$("[data-pay]", content).forEach((btn) => {
      const id = btn.getAttribute("data-pay")!;
      const appointment = appointments.find((a) => a.id === id);
      if (!appointment) return;
      const h = (): void => {
        void handlePay(appointment);
      };
      btn.addEventListener("click", h);
      cleanups.push(() => btn.removeEventListener("click", h));
    });
  }

  // ------------------------------------------------------- Pagamento (cartão)
  /**
   * Abre o modal com o Card Payment Brick (Checkout Bricks) para cobrar um
   * agendamento pendente. O valor exibido vem do `pagamento.valorCentavos`
   * (criado pelo backend a partir do preço do serviço no banco).
   *
   * O token do cartão é gerado pelo próprio Brick; o frontend envia apenas o
   * token + dados do pagador ao backend, que processa a cobrança e define o
   * valor/parcelas. Estados intermediários são finalizados pelo webhook.
   */
  async function abrirModalPagamentoCartao(
    pagamento: PagamentoDTO,
    appointment: Appointment,
  ): Promise<void> {
    if (pagamento.valorCentavos <= 0) {
      showToast("Pagamento sem valor definido. Contate o suporte.", "error");
      renderAgendamentos();
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="card-pay-title">
        <div class="modal__header">
          <h2 class="modal__title" id="card-pay-title">Pagamento com cartão</h2>
          <button type="button" class="modal__close" data-close aria-label="Fechar">${icon("x", 18)}</button>
        </div>
        <div class="modal__body">
          <p class="card-pay__resumo">
            <strong>${escapeHtml(appointment.servicoNome ?? "Serviço")}</strong><br>
            ${formatCurrency(pagamento.valorCentavos / 100)}
          </p>
          <div class="card-payment-brick" aria-label="Formulário de pagamento com cartão"></div>
          <button type="button" class="btn btn--ghost btn--block" data-close-alt>Pagamento indisponível? Voltar</button>
        </div>
      </div>`;

    const container = overlay.querySelector<HTMLElement>(".card-payment-brick")!;
    let desmontar: (() => void) | null = null;

    function limpar(): void {
      if (!overlay.isConnected) return;
      window.setTimeout(() => {
        void desmontar?.();
        overlay.remove();
      }, 300);
    }

    function fechar(): void {
      closeModal(overlay);
      limpar();
    }

    overlay.querySelector("[data-close]")?.addEventListener("click", fechar);
    overlay.querySelector("[data-close-alt]")?.addEventListener("click", fechar);
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) fechar();
    });
    // Escape (tratado globalmente no modal.ts) também dispara `modal:close`.
    overlay.addEventListener("modal:close", limpar);

    document.body.appendChild(overlay);
    openModal(overlay);

    // Monta o Brick com o modal visível (evita falha de layout do MP).
    window.setTimeout(() => {
      void montarCardPaymentBrick({
        container,
        amount: pagamento.valorCentavos / 100,
        callbacks: {
          onError: (error) =>
            showToast(
              error instanceof Error
                ? error.message
                : "Erro ao carregar o pagamento. Tente novamente.",
              "error",
            ),
          onSubmit: async (formData) => {
            try {
              const { status } = await createCardPayment(appointment.id, {
                token: formData.token,
                paymentMethodId: formData.payment_method_id,
                payer: {
                  email: formData.payer?.email ?? "",
                  firstName: formData.payer?.first_name ?? undefined,
                  lastName: formData.payer?.last_name ?? undefined,
                  identification: formData.payer?.identification
                    ? {
                        type: formData.payer.identification.type,
                        number: formData.payer.identification.number,
                      }
                    : undefined,
                },
              });

              if (status === "aprovado") {
                showToast("Pagamento aprovado!", "success");
                fechar();
                renderAgendamentos();
                return true;
              }
              if (status === "pendente") {
                showToast(
                  "Pagamento em processamento. Acompanhe o status em seus agendamentos.",
                  "info",
                );
                fechar();
                renderAgendamentos();
                return true;
              }
              showToast(`Pagamento ${status}.`, "error");
              return false;
            } catch (error) {
              showToast(
                error instanceof Error
                  ? error.message
                  : "Não foi possível processar o pagamento. Tente novamente.",
                "error",
              );
              return false;
            }
          },
        },
      })
        .then((desmontarFn) => {
          desmontar = desmontarFn;
        })
        .catch((error: unknown) => {
          showToast(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o pagamento. Tente novamente.",
            "error",
          );
          fechar();
        });
    }, 80);
  }

  async function handlePay(appointment: Appointment): Promise<void> {
    try {
      const { checkoutUrl, pagamento } = await createPayment(appointment.id);

      // Checkout Bricks é o caminho principal quando a Public Key está
      // configurada; sem ela, mantém o Checkout Pro (fallback histórico).
      if (CONFIG.mercadopagoPublicKey) {
        await abrirModalPagamentoCartao(pagamento, appointment);
        return;
      }

      if (checkoutUrl) {
        // MESMA ABA (não `window.open`): a sessão da SPA vive em sessionStorage,
        // que NÃO é compartilhado com uma nova aba. Abrir o Checkout Pro em nova
        // aba faz o retorno do MP cair sem token — o polling/confirmação
        // falhavam com 401 e o botão "Voltar para minha conta" caía no login.
        // Redirecionar a aba atual preserva a sessão durante todo o fluxo.
        showToast("Redirecionando para o pagamento...", "info");
        window.location.href = checkoutUrl;
        return;
      }
      // Sem URL de checkout: backend registrou pagamento sem link (já
      // aprovado ou recusado). Re-renderiza para refletir o badge real.
      showToast(`Pagamento ${pagamento.status}.`, "info");
      renderAgendamentos();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Não foi possível iniciar o pagamento. Tente novamente.",
        "error",
      );
    }
  }

  async function handleCancel(appointment: Appointment): Promise<void> {
    // Agendamento já pago: o cancelamento não reembolsa automaticamente.
    // Pagamento aprovado NÃO confirma o agendamento (estados separados),
    // mas o cliente precisa saber que o valor pago não será devolvido.
    const isPaid = appointment.pagamentoStatus === "aprovado";
    const confirmed = await confirmDialog(
      isPaid
        ? {
            title: "Cancelar agendamento",
            message:
              "Este agendamento já foi pago. O valor pago não será reembolsado automaticamente. Deseja continuar mesmo assim?",
            confirmLabel: "Cancelar mesmo assim",
            cancelLabel: "Voltar",
            danger: true,
          }
        : {
            title: "Cancelar agendamento",
            message: `Tem certeza que deseja cancelar o agendamento de ${appointment.servicoNome ?? "serviço"}? Essa ação não pode ser desfeita.`,
            confirmLabel: "Sim, cancelar",
            cancelLabel: "Manter",
            danger: true,
          },
    );
    if (!confirmed) return;
    try {
      if (appointment.status === "pendente" || appointment.status === "confirmado") {
        await cancelAppointment(appointment.id);
      }
      showToast("Agendamento cancelado.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível cancelar. Tente novamente.", "error");
    } finally {
      renderAgendamentos();
    }
  }

  // ---------------------------------------------------- Serviços Disponíveis
  function renderServicos(): void {
    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">SERVIÇOS DISPONÍVEIS</h3>
          <p class="manage-head__sub">Escolha um serviço e agende seu horário</p>
        </div>
      </div>
      <div class="table-wrap" data-servicos-wrap>
        <p class="panel__empty">Carregando serviços...</p>
      </div>
    `;

    const wrap = $<HTMLElement>("[data-servicos-wrap]", content);

    // Área do cliente: sem CRUD. A tabela tem uma única ação por linha —
    // AGENDAR — que pré-seleciona o serviço e abre o wizard de agendamento
    // direto na etapa de data/profissional.
    function buildTable(services: Service[]): string {
      if (services.length === 0) {
        return `<p class="panel__empty">Nenhum serviço disponível no momento.</p>`;
      }
      return `
        <table class="table table--fit">
          <thead>
            <tr>
              <th>Nome do Serviço</th>
              <th>Duração</th>
              <th>Preço</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${services
              .map(
                (s) => `
                  <tr>
                    <td><strong>${escapeHtml(s.name)}</strong></td>
                    <td>${s.durationMin} min</td>
                    <td>${formatCurrency(s.price)}</td>
                    <td><span class="cell-actions">
                      <button type="button" class="btn btn--sm btn--primary" data-book-service="${escapeHtml(s.id)}">${icon("calendar", 14)} Agendar</button>
                    </span></td>
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      `;
    }

    function montar(services: Service[]): void {
      if (!wrap) return;
      wrap.innerHTML = buildTable(services);
      bindBookButtons(services);
    }

    async function load(): Promise<void> {
      try {
        const services = await fetchServices();
        montar(services);
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim() !== ""
            ? error.message
            : "Não foi possível carregar os serviços. Tente novamente.";
        if (wrap) {
          wrap.innerHTML = `<p class="panel__empty" role="alert">${escapeHtml(message)}</p>`;
        }
      }
    }

    function bindBookButtons(services: Service[]): void {
      $$("[data-book-service]", content).forEach((btn) => {
        const id = btn.getAttribute("data-book-service")!;
        const service = services.find((s) => s.id === id);
        if (!service) return;
        const h = (): void => wizard.openForService(id);
        btn.addEventListener("click", h);
        cleanups.push(() => btn.removeEventListener("click", h));
      });
    }

    void load();
  }

  // ---------------------------------------------------------------- Contatos
  // Consome o MESMO componente da Home (contactSectionHtml): mudanças de dados
  // ou layout refletem automaticamente nas duas telas. O wrapper
  // .contact-section--panel aplica apenas a cascata de cards responsivos.
  function renderContatos(): void {
    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">CONTATOS</h3>
          <p class="manage-head__sub">Contato, endereço e horários da barbearia</p>
        </div>
      </div>
      <div class="contact-section contact-section--panel">${contactSectionHtml()}</div>
    `;
  }

  // -------------------------------------------------------------- Dependentes
  // Fluxo em MODO MOCK: dados persistidos em localStorage via
  // dependentesService (assinatura async pronta para a API).
  function renderDependentes(): void {
    content.innerHTML = `
      <div class="panel__section manage-head">
        <div class="manage-head__titles">
          <h3 class="panel__section-title">DEPENDENTES</h3>
          <p class="manage-head__sub">Família e acompanhantes que podem ser atendidos</p>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn--primary btn--sm" data-add-dependente>${icon("plus", 16)} NOVO DEPENDENTE</button>
        </div>
      </div>
      <div class="panel__section">
        <div class="table-wrap" data-dependentes-wrap>
          <p class="panel__empty">Carregando dependentes...</p>
        </div>
      </div>
    `;

    const wrap = $<HTMLElement>("[data-dependentes-wrap]", content);
    if (!wrap) return;

    function buildTable(dependentes: Dependente[]): string {
      if (dependentes.length === 0) {
        return `<p class="panel__empty">Nenhum dependente cadastrado ainda. Use “NOVO DEPENDENTE” para adicionar.</p>`;
      }
      return `
        <table class="table table--fit table--dependentes">
          <thead>
            <tr>
              <th>Nome do dependente</th>
              <th>Parentesco</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${dependentes
              .map(
                (d) => `
                  <tr>
                    <td><strong>${escapeHtml(d.nome)}</strong></td>
                    <td><span class="parentesco-label">${PARENTESCO_LABEL[d.parentesco]}</span></td>
                    <td><span class="cell-actions">
                      <button type="button" class="btn btn--sm btn--ghost" data-edit-dependente="${escapeHtml(d.id)}">${icon("edit", 14)} Editar</button>
                      <button type="button" class="btn btn--sm btn--ghost btn--danger-text" data-delete-dependente="${escapeHtml(d.id)}">${icon("trash", 14)} Excluir</button>
                    </span></td>
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      `;
    }

    function bindActions(dependentes: Dependente[]): void {
      $$("[data-edit-dependente]", wrap!).forEach((btn) => {
        const id = btn.getAttribute("data-edit-dependente")!;
        const dependente = dependentes.find((d) => d.id === id);
        if (!dependente) return;
        const h = (): void => {
          void (async () => {
            const saved = await dependentesDialog({
              title: "Editar dependente",
              confirmLabel: "Salvar alterações",
              dependente,
              onSubmit: async (input) => {
                await atualizarDependente(id, input);
              },
            });
            if (saved) {
              showToast("Dependente atualizado.", "success");
              renderDependentes();
            }
          })();
        };
        btn.addEventListener("click", h);
        cleanups.push(() => btn.removeEventListener("click", h));
      });

      $$("[data-delete-dependente]", wrap!).forEach((btn) => {
        const id = btn.getAttribute("data-delete-dependente")!;
        const dependente = dependentes.find((d) => d.id === id);
        if (!dependente) return;
        const h = (): void => {
          void (async () => {
            const confirmed = await confirmDialog({
              title: "Excluir dependente",
              message: `Excluir “${dependente.nome}”? Essa ação não pode ser desfeita.`,
              confirmLabel: "Excluir",
              danger: true,
            });
            if (!confirmed) return;
            try {
              await excluirDependente(id);
              showToast("Dependente excluído.", "success");
              renderDependentes();
            } catch (error) {
              showToast(
                error instanceof Error ? error.message : "Não foi possível excluir.",
                "error",
              );
            }
          })();
        };
        btn.addEventListener("click", h);
        cleanups.push(() => btn.removeEventListener("click", h));
      });
    }

    const addBtn = $<HTMLButtonElement>("[data-add-dependente]", content)!;
    const addHandler = (): void => {
      void (async () => {
        const saved = await dependentesDialog({
          title: "Novo dependente",
          confirmLabel: "Salvar dependente",
          onSubmit: async (input) => {
            await criarDependente(input);
          },
        });
        if (saved) {
          showToast("Dependente cadastrado.", "success");
          renderDependentes();
        }
      })();
    };
    addBtn.addEventListener("click", addHandler);
    cleanups.push(() => addBtn.removeEventListener("click", addHandler));

    void (async () => {
      try {
        const dependentes = await listarDependentes();
        if (wrap) wrap.innerHTML = buildTable(dependentes);
        bindActions(dependentes);
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim() !== ""
            ? error.message
            : "Não foi possível carregar os dependentes. Tente novamente.";
        if (wrap) {
          wrap.innerHTML = `<p class="panel__empty" role="alert">${escapeHtml(message)}</p>`;
        }
      }
    })();
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
    // Alias "/cliente/dependentes" (pedido original) redireciona para a mesma aba.
    if (path === `${base}/servicos` || path === "/cliente/servicos") handleTab("servicos");
    else if (path === `${base}/contatos` || path === "/cliente/contatos") handleTab("contatos");
    else if (path === `${base}/dependentes` || path === "/cliente/dependentes") handleTab("dependentes");
    else if (path === `${base}/configuracoes` || path === "/cliente/configuracoes") handleTab("configuracoes");
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
