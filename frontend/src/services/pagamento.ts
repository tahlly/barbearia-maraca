import { httpJson } from "./api.js";

/* ------------------------------------------------------------------ */
/*  Pagamentos (Mercado Pago)                                          */
/*  Contrato HTTP exposto pelo Backend em /api/agendamentos/:id/...   */
/* ------------------------------------------------------------------ */

export type PagamentoStatus = "pendente" | "aprovado" | "recusado" | "cancelado" | "expirado";

/**
 * Espelho do `PagamentoDTO` do backend (campos em camelCase conforme
 * serialização do backend — knex snake→camel).
 */
export interface PagamentoDTO {
  id: string;
  agendamentoId: string;
  status: PagamentoStatus;
  valorCentavos: number;
  mercadopagoOrderId: string | null;
  mercadopagoPaymentId: string | null;
  checkoutUrl: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

interface CreatePaymentResponse {
  checkoutUrl: string | null;
  pagamento: PagamentoDTO;
}

interface GetPaymentResponse {
  pagamento: PagamentoDTO | null;
}

/**
 * `confirmar-retorno` responde sempre `{ pagamento: PagamentoDTO }`: se o
 * pagamento não existir ou não pertencer ao agendamento, o backend responde
 * 404 (aqui tratado como exceção via httpJson). O contrato não usa null.
 */
interface ConfirmarRetornoResponse {
  pagamento: PagamentoDTO;
}

/**
 * Cria/recupera o pagamento do agendamento e devolve a URL de checkout do
 * Mercado Pago quando disponível. O backend resolve a autorização pelo token:
 * somente o cliente dono pode iniciar.
 * POST /api/agendamentos/:id/pagamento
 */
export async function createPayment(
  id: string,
): Promise<{ checkoutUrl: string | null; pagamento: PagamentoDTO }> {
  const data = await httpJson<CreatePaymentResponse>(
    `/agendamentos/${encodeURIComponent(id)}/pagamento`,
    { method: "POST" },
  );
  return { checkoutUrl: data.checkoutUrl, pagamento: data.pagamento };
}

/**
 * Busca o pagamento atual do agendamento (para polling/confirmação).
 * Devolve `null` quando o agendamento ainda não possui pagamento registrado.
 * GET /api/agendamentos/:id/pagamento
 */
export async function getPayment(id: string): Promise<PagamentoDTO | null> {
  const data = await httpJson<GetPaymentResponse>(
    `/agendamentos/${encodeURIComponent(id)}/pagamento`,
  );
  return data.pagamento;
}

/**
 * Confirma o retorno do checkout Mercado Pago junto ao backend. O backend
 * responde sempre `{ pagamento }` não-null; quando o pagamento não
 * existe/não pertence ao agendamento, responde 404 (propagado como ApiError).
 * O caller trata erro via try/catch.
 *
 * `paymentId` é OPCIONAL: quando a URL de retorno não o trouxe, o backend
 * resolve o pagamento pela `external_reference` local (busca no MP). Nesse
 * caso o corpo vai vazio.
 *
 * O backend valida a autorização pelo token: somente o cliente dono (ou
 * admin) pode confirmar o próprio retorno.
 * POST /api/agendamentos/:id/pagamento/confirmar-retorno
 */
export async function confirmarRetorno(
  id: string,
  paymentId?: string | null,
): Promise<PagamentoDTO> {
  const payload: { paymentId?: string } = paymentId ? { paymentId } : {};
  const data = await httpJson<ConfirmarRetornoResponse>(
    `/agendamentos/${encodeURIComponent(id)}/pagamento/confirmar-retorno`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return data.pagamento;
}

/**
 * Cancela o pagamento pendente do agendamento (desistência no checkout).
 * O backend marca SOMENTE o pagamento pendente como `cancelado`; nunca
 * desfaz um pagamento aprovado e não altera o agendamento. Devolve `null`
 * quando o agendamento não possui pagamento pendente para cancelar.
 * O caller decide se o erro é crítico (o fluxo pode seguir funcional mesmo
 * quando esta chamada falha, por isso o retorno pode ser ignorado).
 * POST /api/agendamentos/:id/pagamento/cancelar  (sem body)
 */
export async function cancelarPagamento(id: string): Promise<PagamentoDTO | null> {
  const data = await httpJson<GetPaymentResponse>(
    `/agendamentos/${encodeURIComponent(id)}/pagamento/cancelar`,
    { method: "POST" },
  );
  return data.pagamento;
}

/* ------------------------------------------------------------------ */
/*  Checkout Bricks (Cartão) — cobrança direta sem redirect            */
/*  Contrato: POST /api/agendamentos/:id/pagamento/cartao             */
/* ------------------------------------------------------------------ */

/** Comprador enviado ao backend (espelho do PayerCartaoMercadoPago). */
export interface CardPayerInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  identification?: { type: string; number: string } | null;
}

/** Corpo da cobrança no cartão (o backend define valor e parcelas). */
export interface CardPaymentInput {
  token: string;
  paymentMethodId: string;
  payer: CardPayerInput;
}

export interface CardPaymentResult {
  status: PagamentoStatus;
  pagamento: PagamentoDTO;
}

/**
 * Cobra no cartão usando o token gerado pelo Card Payment Brick. Retorna o
 * status síncrono (aprovado/recusado/cancelado/expirado/pendente); estados
 * intermediários (`pending`, `in_process`) são finalizados pelo webhook.
 * POST /api/agendamentos/:id/pagamento/cartao
 */
export async function createCardPayment(
  id: string,
  input: CardPaymentInput,
): Promise<CardPaymentResult> {
  const data = await httpJson<CardPaymentResult>(
    `/agendamentos/${encodeURIComponent(id)}/pagamento/cartao`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return { status: data.status, pagamento: data.pagamento };
}
