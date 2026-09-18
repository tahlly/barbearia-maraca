import { $, escapeHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { pagamentoBadgeHtml } from "../ui/pagamentoBadge.js";
import {
  cancelarPagamento,
  confirmarRetorno,
  createPayment,
  getPayment,
  type PagamentoDTO,
} from "../services/pagamento.js";
import { getSession } from "../services/auth.js";
import { ApiError } from "../services/api.js";
import { navigateTo } from "../router.js";

/* ------------------------------------------------------------------ */
/*  Retorno do checkout Mercado Pago (#/pagamento/retorno)            */
/*  Feedback visual apenas: o estado real é confirmado via            */
/*  GET /api/agendamentos/:id/pagamento (nunca confia na URL).        */
/*  O Checkout Pro é aberto na MESMA aba (ver minhaConta.ts) para que */
/*  o sessionStorage sobreviva ao redirect — sem isso, o retorno      */
/*  chega sem token e todas as chamadas falham com 401.               */
/*  No retorno `success`, tenta uma confirmação imediata via          */
/*  POST /api/agendamentos/:id/pagamento/confirmar-retorno; se não    */
/*  aprovar (ou faltar payment_id), o polling continua como fallback. */
/*  No retorno `failure` (desistência), o pagamento pendente é        */
/*  marcado como `cancelado` via POST .../pagamento/cancelar (erro    */
/*  é ignorado; a tela segue funcional).                              */
/*  Pagamento aprovado NÃO confirma o agendamento (estados separados).*/
/* ------------------------------------------------------------------ */

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_MS = 2 * 60 * 1000;

type RetornoStatus = "success" | "failure" | "pending" | null;

interface QueryParams {
  status: RetornoStatus;
  agendamento: string | null;
  paymentId: string | null;
}

const TERMINAL_STATUS: ReadonlySet<PagamentoDTO["status"]> = new Set([
  "aprovado",
  "recusado",
  "cancelado",
  "expirado",
]);

function readQueryParams(): QueryParams {
  // O MP anexa payment_id/status à URL de retorno, mas o FORMATO varia:
  // 1) dentro do hash — `#/pagamento/retorno?status=success&agendamento=X&payment_id=...`;
  // 2) antes do hash — `/?payment_id=...&...#/pagamento/retorno?status=success&agendamento=X`;
  // 3) com `?` extra no lugar de `&` (o MP às vezes concatena sem checar).
  // Unimos search + hash e normalizamos `?`/`#` para `&` antes do
  // URLSearchParams, assim `payment_id` nunca é perdido/corrompido.
  // NUNCA confiamos em `status` do MP: só aceitamos success/failure/pending
  // do NOSSO back_url.
  const source = `${window.location.search}${window.location.hash}`;
  const queryIndex = source.indexOf("?");
  let status: RetornoStatus = null;
  let agendamento: string | null = null;
  let paymentId: string | null = null;
  if (queryIndex !== -1) {
    const normalized = source.slice(queryIndex + 1).replace(/[?#]/g, "&");
    const params = new URLSearchParams(normalized);
    const raw = params.get("status");
    if (raw === "success" || raw === "failure" || raw === "pending") status = raw;
    agendamento = params.get("agendamento");
    paymentId = params.get("payment_id");
  }
  return { status, agendamento, paymentId };
}

function isTerminal(status: PagamentoDTO["status"] | null): status is PagamentoDTO["status"] {
  return status !== null && TERMINAL_STATUS.has(status);
}

export function renderPagamentoRetorno(container: HTMLElement): () => void {
  const { status, agendamento, paymentId } = readQueryParams();

  // NÃO há gate de sessão nesta tela: o retorno do Checkout Pro pode cair na
  // origem pública (ngrok) onde o sessionStorage está vazio, e a tela de
  // status deve SEMPRE renderizar (jamais "grudar" no login). A autorização
  // fica nas chamadas de API (httpJson trata 401); se a sessão existir, o
  // fluxo confirma/atualiza normalmente.

  container.innerHTML = `
    <section class="section">
      <div class="container pagamento-retorno">
        <div class="card">
          <span class="section__eyebrow">Pagamento</span>
          <h1 class="section__title">Status do pagamento</h1>
          <div data-pagamento-status></div>
          <!-- Botão presente em TODOS os desfechos (sucesso/falha/pendente/
               link inválido): somente a região de status é alterada. -->
          <div class="pagamento-retorno__actions">
            <button type="button" class="btn btn--ghost" data-voltar-conta>${icon("arrow-left", 16)} Voltar para minha conta</button>
          </div>
        </div>
      </div>
    </section>
  `;

  let disposed = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const statusRegion = $<HTMLElement>("[data-pagamento-status]", container);
  const voltarBtn = $<HTMLButtonElement>("[data-voltar-conta]", container);

  const setStatusHtml = (html: string): void => {
    if (!disposed && statusRegion) statusRegion.innerHTML = html;
  };

  const alertHtml = (variant: string, message: string, badge = "", iconName = "info-circle"): string =>
    `<div class="alert alert--${variant}" role="status">${icon(iconName, 18)}<span>${escapeHtml(message)} ${badge}</span></div>`;

  const fadeTo = (variant: string, message: string, badge = "", iconName = "info-circle"): void =>
    setStatusHtml(alertHtml(variant, message, badge, iconName));

  const cleanup = (): void => {
    disposed = true;
    if (pollTimer) clearTimeout(pollTimer);
    voltarBtn?.removeEventListener("click", voltarHandler);
  };

  const voltarHandler = (): void => {
    navigateTo("/minha-conta");
  };
  voltarBtn?.addEventListener("click", voltarHandler);

  // Link sem agendamento: não há o que confirmar.
  if (!agendamento || !statusRegion) {
    fadeTo("danger", "Link de retorno inválido: não foi possível identificar o agendamento.");
    return cleanup;
  }
  // Alias após o guard: funções declaradas (hoisted) não propagam o
  // narrowing de `agendamento` para dentro dos closures — este alias é
  // um `string` e pode ser capturado com segurança.
  const agendamentoId: string = agendamento;
  // `paymentId` é opcional: quando a URL não trouxe `payment_id`, o backend
  // resolve o pagamento pela `external_reference` local (busca no MP).
  const paymentIdValue: string | null = paymentId;

  function renderEstadoInicial(): void {
    switch (status) {
      case "success":
        // Mensagem neutra e transitória: o estado final é resolvido em
        // `confirmarRetornoComFallback` (confirmação imediata via API →
        // sucesso final, ou polling como fallback). Nenhum badge pendente
        // aqui: não sabemos ainda o status real do pagamento.
        fadeTo("info", "Confirmando seu pagamento...", "", "clock");
        break;
      case "failure":
        // Desistência no checkout: mensagem final com badge PAGAMENTO
        // CANCELADO; a opção "Tentar pagar novamente" é inserida abaixo.
        fadeTo(
          "danger",
          "O pagamento não foi concluído.",
          pagamentoBadgeHtml("cancelado"),
          "error-circle",
        );
        break;
      case "pending":
        fadeTo(
          "warning",
          "Aguardando a confirmação do pagamento. Esta página é atualizada automaticamente.",
          pagamentoBadgeHtml("pendente"),
          "clock",
        );
        break;
      default:
        fadeTo("info", "Consultando o status do pagamento...", "", "clock");
    }
  }

  function renderFinal(pagamento: PagamentoDTO): void {
    if (pagamento.status === "aprovado") {
      // Pagamento aprovado NÃO confirma o agendamento: apenas informa o
      // pagamento em si. O status do agendamento continua separado.
      fadeTo(
        "success",
        "Pagamento realizado",
        pagamentoBadgeHtml("aprovado"),
        "check-circle",
      );
    } else {
      fadeTo(
        "warning",
        "Não foi possível confirmar o pagamento agora. Verifique o status em Minha Conta.",
        pagamentoBadgeHtml(pagamento.status),
        "alert-circle",
      );
    }
  }

  const retryButtonHtml = (): string =>
    `<div class="pagamento-retorno__retry"><button type="button" class="btn btn--primary" data-tentar-novamente>${icon("credit-card", 16)} Tentar pagar novamente</button></div>`;

  function bindRetry(): void {
    const retryBtn = $<HTMLButtonElement>("[data-tentar-novamente]", container);
    if (!retryBtn) return;
    const h = (): void => {
      void (async () => {
        retryBtn.disabled = true;
        retryBtn.classList.add("is-loading");
        try {
          const result = await createPayment(agendamentoId);
          if (result.checkoutUrl) {
            window.location.href = result.checkoutUrl;
            return;
          }
          fadeTo(
            "warning",
            "O pagamento já foi registrado. Verifique o status em Minha Conta.",
            pagamentoBadgeHtml(result.pagamento.status),
            "info-circle",
          );
        } catch (error) {
          const message =
            error instanceof Error && error.message.trim() !== ""
              ? error.message
              : "Não foi possível iniciar o pagamento. Tente novamente.";
          fadeTo("danger", message, "", "error-circle");
        } finally {
          retryBtn.disabled = false;
          retryBtn.classList.remove("is-loading");
        }
      })();
    };
    retryBtn.addEventListener("click", h);
    // No cleanup: o botão é descartado junto com o container (rota desmontada).
  }

  /**
   * Polling de confirmação: consulta GET /agendamentos/:id/pagamento a cada
   * 4s por até ~2min. Estado `pendente` (ou ausente) mantém a espera; status
   * terminal (aprovado/recusado/cancelado/expirado) encerra o polling.
   */
  function startPolling(): void {
    const startedAt = Date.now();
    const maxAttempts = Math.ceil(POLL_MAX_MS / POLL_INTERVAL_MS);
    let attempts = 0;

    const scheduleNext = (): void => {
      if (disposed) return;
      attempts += 1;
      if (attempts > maxAttempts || Date.now() - startedAt >= POLL_MAX_MS) {
        fadeTo(
          "warning",
          "A confirmação do pagamento está demorando mais que o esperado. Verifique o status em Minha Conta em instantes.",
          "",
          "clock",
        );
        return;
      }
      pollTimer = setTimeout(() => {
        void check();
      }, POLL_INTERVAL_MS);
    };

    const check = async (): Promise<void> => {
      if (disposed) return;
      try {
        const pagamento = await getPayment(agendamentoId);
        if (disposed) return;
        if (pagamento === null || !isTerminal(pagamento.status)) {
          scheduleNext();
          return;
        }
        renderFinal(pagamento);
      } catch (error) {
        if (disposed) return;
        if (error instanceof ApiError && error.status === 401) {
          // Sem sessão válida nesta origem: nenhuma chamada autenticada vai
          // funcionar. Encerra com aviso claro em vez de reiterar 401.
          fadeTo(
            "warning",
            "Sua sessão expirou. Entre em Minha Conta para conferir o status do pagamento.",
            "",
            "alert-circle",
          );
          return;
        }
        scheduleNext();
      }
    };

    void check();
  }

  /**
   * Retorno `success`: confirmação imediata e autoritativa via
   * POST /api/agendamentos/:id/pagamento/confirmar-retorno. O endpoint é
   * idempotente (aprovado → no-op), consulta a API do MP na hora e aceita
   * `payment_id` ausente (resolve pela referência local) — por isso é a fonte
   * primária:
   * - status terminal (aprovado/recusado/cancelado/expirado) → renderiza o
   *   estado final AGORA ("Pagamento realizado" quando aprovado);
   * - `pending`/`in_process`/erro transitório → reitera no mesmo intervalo do
   *   polling até o limite de ~2min (evita depender só do webhook, que pode
   *   atrasar em ambiente local);
   * - 401 (sessão ausente/expirada) → NÃO reitera: avisa para entrar em Minha
   *   Conta, evitando loop de requisições não autorizadas;
   * - expirado o limite → cai no polling GET local como último fallback.
   */
  async function confirmarRetornoComFallback(): Promise<void> {
    const startedAt = Date.now();
    const maxTentativas = Math.ceil(POLL_MAX_MS / POLL_INTERVAL_MS);
    let tentativas = 0;

    const tentar = async (): Promise<void> => {
      if (disposed) return;
      tentativas += 1;
      if (tentativas > maxTentativas || Date.now() - startedAt >= POLL_MAX_MS) {
        // Limite da confirmação imediata: cai no polling GET local (prod: o
        // webhook já deve ter atualizado o banco até aqui).
        startPolling();
        return;
      }
      let pagamento: PagamentoDTO | null = null;
      try {
        pagamento = await confirmarRetorno(agendamentoId, paymentIdValue);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          fadeTo(
            "warning",
            "Sua sessão expirou. Entre em Minha Conta para conferir o status do pagamento.",
            "",
            "alert-circle",
          );
          return;
        }
        // Erro transitório (rede/5xx/404): ignora e reitera.
      }
      if (disposed) return;
      if (pagamento !== null && isTerminal(pagamento.status)) {
        renderFinal(pagamento);
        return;
      }
      pollTimer = setTimeout(() => {
        void tentar();
      }, POLL_INTERVAL_MS);
    };

    void tentar();
  }

  renderEstadoInicial();
  if (status === "failure") {
    // Desistência no checkout: marca o pagamento pendente como `cancelado`
    // para que Minha Conta reflita a desistência. Só chamamos a API quando há
    // sessão válida nesta origem (evita 401 desnecessário). Erro é
    // intencionalmente ignorado (swallow) — a tela segue funcional com o retry.
    if (getSession()) {
      void cancelarPagamento(agendamentoId).catch(() => undefined);
    }
    statusRegion.insertAdjacentHTML("beforeend", retryButtonHtml());
    bindRetry();
  } else if (status === "success") {
    void confirmarRetornoComFallback();
  } else {
    startPolling();
  }

  return cleanup;
}