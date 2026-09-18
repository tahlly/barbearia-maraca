import type { Request } from 'express';
import { paraCentavos } from '../utils/dinheiro';
import { validarAssinaturaWebhook } from '../utils/mercadopago-assinatura';
import {
  criarPreferencia,
  criarPagamentoCartao,
  obterPayment,
  buscarPagamentosPorReferenciaExterna,
  ErroApiMercadoPago,
  type PagamentoMercadoPago,
  type PayerCartaoMercadoPago,
} from './mercadopago-client';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';
import { InternalError } from '../errors/InternalError';
import type { PagamentoDTO, PagamentoStatus } from '../dtos/pagamento-dto';
import {
  criar as criarPagamentoRepository,
  buscarPorId as buscarPagamentoPorId,
  buscarPorAgendamentoMaisRecente,
  buscarPendentePorAgendamento,
  buscarPorOrderId,
  atualizarStatus as atualizarStatusPagamento,
  atualizarDadosOrdem,
  ConflitoPagamentoPendente,
  type PagamentoRow,
} from '../repositories/pagamento-repository';
import {
  buscarPorId as buscarAgendamentoPorId,
  buscarClientePorUsuarioId,
  buscarDadosServicoDoAgendamento,
} from '../repositories/agendamento-repository';

function toPagamentoDTO(row: PagamentoRow): PagamentoDTO {
  return {
    id: row.id,
    agendamentoId: row.agendamento_id,
    status: row.status,
    valorCentavos: row.valor_centavos,
    mercadopagoOrderId: row.mercadopago_order_id,
    mercadopagoPaymentId: row.mercadopago_payment_id,
    checkoutUrl: row.checkoutUrl,
    criadoEm:
      row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at ?? undefined),
    atualizadoEm:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at ?? undefined),
  };
}

/**
 * Cria (ou reutiliza) o pagamento de um agendamento via Mercado Pago Checkout
 * Pro (Preferences API). Apenas o cliente DONO do agendamento. Regras:
 * - agendamento cancelado/concluido → 400;
 * - pagamento já aprovado (mais recente) → 400;
 * - pendente existente → reuso (sem chamar o MP de novo);
 * - preço/nome do serviço vêm do BANCO (nunca do cliente);
 * - grava `valor_centavos` e depois o id da preferência real do MP.
 */
export async function criarPagamento(
  usuarioId: string,
  role: string,
  agendamentoId: string,
): Promise<{ checkoutUrl: string | null; pagamento: PagamentoDTO }> {
  if (role !== 'cliente') {
    throw new ForbiddenError('Acesso negado');
  }

  const cliente = await buscarClientePorUsuarioId(usuarioId);
  if (!cliente) {
    throw new ForbiddenError('Perfil de cliente não encontrado');
  }

  const agendamento = await buscarAgendamentoPorId(agendamentoId);
  if (!agendamento) {
    throw new NotFoundError('Agendamento não encontrado');
  }
  if (agendamento.cliente_id !== cliente.id) {
    throw new ForbiddenError('Acesso negado');
  }
  if (agendamento.status === 'cancelado' || agendamento.status === 'concluido') {
    throw new ValidationError(`Agendamento ${agendamento.status} não permite gerar pagamento`);
  }

  const maisRecente = await buscarPorAgendamentoMaisRecente(agendamentoId);
  if (maisRecente?.status === 'aprovado') {
    throw new ValidationError('Pagamento já aprovado para este agendamento');
  }

  // Reuso de pendente (double-click / corrida de checkout duplo): o índice
  // único parcial (agendamento_id WHERE status='pendente') garante no banco que
  // existe no máximo um pendente. Devolvemos o existente SEM chamar o MP.
  const pendenteExistente = await buscarPendentePorAgendamento(agendamentoId);
  if (pendenteExistente) {
    return {
      checkoutUrl: pendenteExistente.checkoutUrl ?? null,
      pagamento: toPagamentoDTO(pendenteExistente),
    };
  }

  const servico = await buscarDadosServicoDoAgendamento(agendamentoId);
  if (!servico) {
    throw new NotFoundError('Serviço do agendamento não encontrado');
  }
  // Preço vem do banco (decimal(10,2)); converte para centavos (int da coluna).
  // Valores cotidianos caem bem abaixo do limite do integer do Postgres.
  const valorCentavos = Number(paraCentavos(servico.preco));

  let pagamento: PagamentoRow;
  try {
    pagamento = await criarPagamentoRepository({ agendamentoId, valorCentavos });
  } catch (error) {
    if (error instanceof ConflitoPagamentoPendente) {
      // Perdeu a corrida: outra requisição criou o pendente entre o SELECT e o
      // INSERT (ou o pendente voltou a existir). Reutiliza-o, sem chamar o MP.
      const pendente = await buscarPendentePorAgendamento(agendamentoId);
      if (!pendente) {
        throw new InternalError('Estado inconsistente: conflito de pendente sinalizado pelo banco');
      }
      return {
        checkoutUrl: pendente.checkoutUrl ?? null,
        pagamento: toPagamentoDTO(pendente),
      };
    }
    throw error;
  }

  // MP exige back_urls com domínio público e HTTPS (rejeita localhost/127.0.0.1;
  // doc: "Do not use local domains" + "https é obrigatório"). A base vem das
  // variáveis de ambiente do frontend, sem hardcode: FRONTEND_URL_PUBLICA é o
  // override público (dev: túnel ngrok) para atender à exigência HTTPS do MP;
  // FRONTEND_URL é a variável canônica do SPA (produção: domínio real); o
  // fallback "http://localhost:5173" cobre ambiente sem variável configurada.
  const backUrlBase =
    process.env.FRONTEND_URL_PUBLICA ??
    process.env.FRONTEND_URL ??
    'http://localhost:5173';
  try {
    const preferencia = await criarPreferencia({
      // X-Idempotency-Key e external_reference = id do pagamento: o MP garante
      // que a mesma chave não cria duas preferências no mesmo intent.
      idempotencyKey: pagamento.id,
      externalReference: pagamento.id,
      titulo: servico.nome,
      valorCentavos,
      backUrls: {
        success: `${backUrlBase}/#/pagamento/retorno?status=success&agendamento=${agendamentoId}`,
        failure: `${backUrlBase}/#/pagamento/retorno?status=failure&agendamento=${agendamentoId}`,
        pending: `${backUrlBase}/#/pagamento/retorno?status=pending&agendamento=${agendamentoId}`,
      },
    });
    await atualizarDadosOrdem(pagamento.id, {
      orderId: preferencia.id,
      checkoutUrl: preferencia.checkoutUrl,
    });
    return {
      checkoutUrl: preferencia.checkoutUrl,
      pagamento: toPagamentoDTO({
        ...pagamento,
        mercadopago_order_id: preferencia.id,
        checkoutUrl: preferencia.checkoutUrl,
      }),
    };
  } catch (error) {
    // DECISÃO (documentada): se a criação da preferência no MP falhar (rede,
    // 4xx/5xx, timeout), o pagamento NÃO permanece pendente órfão — transiciona
    // para `cancelado` (rastro da tentativa) e libera o índice único parcial
    // para nova tentativa. A exceção original segue para o errorHandler como 500.
    try {
      await atualizarStatusPagamento(pagamento.id, 'cancelado');
    } catch (erroInterno) {
      console.error(
        '[pagamento-service] falha ao marcar pagamento cancelado após erro do MP:',
        erroInterno,
      );
    }
    throw error;
  }
}

/**
 * Dados de cobrança enviados pelo Card Payment Brick (Checkout Bricks). O
 * backend NÃO confia em valor/parcelas: o valor vem do banco e as parcelas
 * são fixadas em 1 (barbearia não oferece parcelamento online).
 */
export interface DadosCartaoPagamento {
  token: string;
  paymentMethodId: string;
  payer: PayerCartaoMercadoPago;
}

/**
 * Cria a cobrança no cartão via Mercado Pago Checkout Bricks — API Payments
 * (POST /v1/payments), usando o token gerado pelo Card Payment Brick no
 * navegador. Apenas o cliente DONO do agendamento. Regras:
 * - agendamento cancelado/concluido → 400;
 * - pagamento já aprovado (mais recente) → 400;
 * - pendente existente → reuso (tentativa de novo cartão), sem duplicar;
 * - preço/nome do serviço vêm do BANCO (nunca do cliente);
 * - `transaction_amount` = valorCentavos do pagamento no banco; parcelas = 1;
 * - `external_reference` = id do pagamento (mesmo padrão webhook);
 * - status aprovado (approved+accredited) atualiza SOMENTE o pagamento: o
 *   status do agendamento NÃO é alterado pelo pagamento (a confirmação do
 *   atendimento é exclusiva do fluxo manual de confirmação);
 *   recusado/cancelado/expirado atualiza o pagamento;
 *   pending/in_process/authorized mantém pendente e aguarda o webhook ou o
 *   retorno do Checkout Pro (`confirmar-retorno`);
 * - falha na cobrança NÃO cancela o pendente (permite nova tentativa com
 *   outro cartão); a exceção segue como 500 e o frontend oferece retry.
 */
export async function criarPagamentoComCartao(
  usuarioId: string,
  role: string,
  agendamentoId: string,
  dadosCartao: DadosCartaoPagamento,
): Promise<{ status: PagamentoStatus; pagamento: PagamentoDTO }> {
  if (role !== 'cliente') {
    throw new ForbiddenError('Acesso negado');
  }

  const cliente = await buscarClientePorUsuarioId(usuarioId);
  if (!cliente) {
    throw new ForbiddenError('Perfil de cliente não encontrado');
  }

  const agendamento = await buscarAgendamentoPorId(agendamentoId);
  if (!agendamento) {
    throw new NotFoundError('Agendamento não encontrado');
  }
  if (agendamento.cliente_id !== cliente.id) {
    throw new ForbiddenError('Acesso negado');
  }
  if (agendamento.status === 'cancelado' || agendamento.status === 'concluido') {
    throw new ValidationError(`Agendamento ${agendamento.status} não permite gerar pagamento`);
  }

  const maisRecente = await buscarPorAgendamentoMaisRecente(agendamentoId);
  if (maisRecente?.status === 'aprovado') {
    throw new ValidationError('Pagamento já aprovado para este agendamento');
  }

  // Reutiliza o pendente existente (tentativa de novo cartão / double-click);
  // senão cria um pendente para esta tentativa com preço vindo do BANCO.
  let pagamento = await buscarPendentePorAgendamento(agendamentoId);
  if (!pagamento) {
    const servicoParaCriar = await buscarDadosServicoDoAgendamento(agendamentoId);
    if (!servicoParaCriar) {
      throw new NotFoundError('Serviço do agendamento não encontrado');
    }
    const valorCentavos = Number(paraCentavos(servicoParaCriar.preco));
    try {
      pagamento = await criarPagamentoRepository({ agendamentoId, valorCentavos });
    } catch (error) {
      if (error instanceof ConflitoPagamentoPendente) {
        const pendente = await buscarPendentePorAgendamento(agendamentoId);
        if (!pendente) {
          throw new InternalError('Estado inconsistente: conflito de pendente sinalizado pelo banco');
        }
        pagamento = pendente;
      } else {
        throw error;
      }
    }
  }

  const servico = await buscarDadosServicoDoAgendamento(agendamentoId);
  if (!servico) {
    throw new NotFoundError('Serviço do agendamento não encontrado');
  }

  let pagamentoMp: PagamentoMercadoPago;
  try {
    pagamentoMp = await criarPagamentoCartao({
      idempotencyKey: pagamento.id,
      externalReference: pagamento.id,
      titulo: servico.nome,
      valorCentavos: pagamento.valor_centavos,
      tokenCartao: dadosCartao.token,
      paymentMethodId: dadosCartao.paymentMethodId,
      installments: 1,
      payer: dadosCartao.payer,
    });
  } catch (error) {
    // DECISÃO (documentada): falha na cobrança não destrói a tentativa — o
    // pendente permanece para novo cartão. A exceção segue ao errorHandler
    // como 500 e o frontend exibe erro com opção de tentar novamente.
    throw error;
  }

  const status = mapearStatusPagamento(pagamentoMp);
  if (status === null) {
    console.warn(
      `[pagamento-service] status de pagamento desconhecido (${pagamentoMp.status ?? '(ausente)'}) — estado atual mantido (paymentId=${pagamentoMp.id ?? '?'})`,
    );
    return { status: 'pendente', pagamento: toPagamentoDTO(pagamento) };
  }

  if (status === 'aprovado') {
    const paymentId = extrairPaymentIdAprovado(pagamentoMp);
    if (!paymentId) {
      console.warn(
        `[pagamento-service] payment approved sem accredited (paymentId=${pagamentoMp.id ?? '?'}) — estado atual mantido`,
      );
      return { status: 'pendente', pagamento: toPagamentoDTO(pagamento) };
    }

    await atualizarStatusPagamento(pagamento.id, 'aprovado', {
      mercadopagoPaymentId: paymentId,
    });
    const atualizado = await buscarPagamentoPorId(pagamento.id);
    return { status: 'aprovado', pagamento: toPagamentoDTO(atualizado ?? pagamento) };
  }

  if (status === 'recusado' || status === 'cancelado' || status === 'expirado') {
    await atualizarStatusPagamento(pagamento.id, status, {
      mercadopagoPaymentId: pagamentoMp.id ?? null,
    });
    const atualizado = await buscarPagamentoPorId(pagamento.id);
    return { status, pagamento: toPagamentoDTO(atualizado ?? pagamento) };
  }

  // status === 'pendente' (pending/in_process/authorized): guarda o payment id
  // para rastreio; a atualização do status pode vir do webhook ou do retorno
  // do Checkout Pro (confirmar-retorno). O agendamento NÃO é alterado aqui.
  if (pagamentoMp.id) {
    await atualizarStatusPagamento(pagamento.id, 'pendente', {
      mercadopagoPaymentId: pagamentoMp.id,
    });
  }
  const atualizado = await buscarPagamentoPorId(pagamento.id);
  return { status: 'pendente', pagamento: toPagamentoDTO(atualizado ?? pagamento) };
}

/**
 * Obtém o pagamento mais recente de um agendamento (cliente dono OU admin).
 * Retorna null quando não existe — o handler devolve 200 com
 * `{ pagamento: null }` para o polling do frontend.
 */
export async function obterPagamento(
  usuarioId: string,
  role: string,
  agendamentoId: string,
): Promise<PagamentoDTO | null> {
  if (role !== 'cliente' && role !== 'admin') {
    throw new ForbiddenError('Acesso negado');
  }

  const agendamento = await buscarAgendamentoPorId(agendamentoId);
  if (!agendamento) {
    throw new NotFoundError('Agendamento não encontrado');
  }
  if (role === 'cliente') {
    const cliente = await buscarClientePorUsuarioId(usuarioId);
    if (!cliente || cliente.id !== agendamento.cliente_id) {
      throw new ForbiddenError('Acesso negado');
    }
  }

  const pagamento = await buscarPorAgendamentoMaisRecente(agendamentoId);
  return pagamento ? toPagamentoDTO(pagamento) : null;
}

/**
 * Cancela o pagamento PENDENTE mais recente de um agendamento quando o
 * cliente DESISTE no checkout do Mercado Pago (MP devolve status=failure na
 * back_url e o frontend chama este endpoint para ocultar o botão PAGAR).
 *
 * POST /api/agendamentos/:id/pagamento/cancelar — ROTA SEPARADA do fluxo de
 * cancelamento de agendamento: este endpoint NUNCA altera `agendamento.status`
 * (a confirmação/cancelamento do atendimento é exclusiva dos fluxos próprios).
 *
 * Regras:
 * - autorização: cliente DONO do agendamento OU admin; demais papéis → 403;
 * - agendamento inexistente → 404;
 * - idempotente, sem chamar o Mercado Pago:
 *   - pendente → `cancelado`;
 *   - aprovado → no-op (jamais desfaz pagamento aprovado);
 *   - já cancelado/recusado/expirado → no-op;
 *   - não existe pagamento → retorno nulo (200 com `{ pagamento: null }`).
 */
export async function cancelarPagamentoPendente(
  usuarioId: string,
  role: string,
  agendamentoId: string,
): Promise<PagamentoDTO | null> {
  if (role !== 'cliente' && role !== 'admin') {
    throw new ForbiddenError('Acesso negado');
  }

  const agendamento = await buscarAgendamentoPorId(agendamentoId);
  if (!agendamento) {
    throw new NotFoundError('Agendamento não encontrado');
  }
  if (role === 'cliente') {
    const cliente = await buscarClientePorUsuarioId(usuarioId);
    if (!cliente || cliente.id !== agendamento.cliente_id) {
      throw new ForbiddenError('Acesso negado');
    }
  }

  // Pagamento mais recente é a fonte local da verdade (mesma regra do
  // obterPagamento). O cancelamento NÃO consulta o MP: o desistiu no checkout
  // é informado pelo próprio cliente na SPA e o estado local `pendente` não
  // representa dinheiro confirmado.
  const pagamento = await buscarPorAgendamentoMaisRecente(agendamentoId);
  if (!pagamento) {
    return null;
  }

  if (pagamento.status === 'pendente') {
    await atualizarStatusPagamento(pagamento.id, 'cancelado');
    const atualizado = await buscarPagamentoPorId(pagamento.id);
    return toPagamentoDTO(atualizado ?? pagamento);
  }

  // aprovado / cancelado / recusado / expirado → no-op (retorna estado atual).
  return toPagamentoDTO(pagamento);
}

// ── Webhook do Mercado Pago (Checkout Pro / Preferences API) ────────────

export interface ResultadoWebhookDTO {
  aceito: boolean;
  motivo?: string;
  status?: PagamentoStatus;
}

const STATUS_PAGAMENTO_MP: Record<string, PagamentoStatus> = {
  // Pagamento aprovado e creditado → aprovado (regra adiante exige
  // status='approved' + status_detail='accredited').
  approved: 'aprovado',
  rejected: 'recusado',
  cancelled: 'cancelado',
  // Fallback defensivo (estado de ordem antigo); payments não usam `expired`.
  expired: 'expirado',
  // Estados intermediários: mantém pendente (no-op).
  pending: 'pendente',
  in_process: 'pendente',
  authorized: 'pendente',
  in_mediation: 'pendente',
  // refunded / charged_back: NÃO alteram o status local — um agendamento já
  // confirmado não é desfeito aqui (decisão de negócio em revisão).
};

function mapearStatusPagamento(pagamento: PagamentoMercadoPago): PagamentoStatus | null {
  const status = pagamento.status ?? '';
  const mapeado = STATUS_PAGAMENTO_MP[status];
  if (!mapeado) {
    console.warn(
      `[webhook-mercadopago] status de pagamento desconhecido (${status}) — estado atual mantido (paymentId=${pagamento.id ?? '?'})`,
    );
    return null;
  }
  return mapeado;
}

/** Só `approved` + `accredited` equivale a dinheiro confirmado (Checkout Pro). */
function extrairPaymentIdAprovado(pagamento: PagamentoMercadoPago): string | null {
  if (pagamento.status === 'approved' && pagamento.statusDetail === 'accredited') {
    return pagamento.id;
  }
  return null;
}

/**
 * Processa o webhook `type=payment` do Mercado Pago. Endpoint PÚBLICO.
 *
 * Fluxo (síncrono, idempotente):
 * 1. valida assinatura HMAC (x-signature) — 401 se inválida;
 * 2. aceita apenas `type=payment`;
 * 3. NÃO confia no corpo do webhook: consulta o pagamento na API do MP
 *    (GET /v1/payments/{id}) e deriva o registro pelo `external_reference`,
 *    que é o id do nosso pagamento (mesma regra da criação da preferência);
 * 4. pagamento desconhecido no banco → 200 + log (sem retry infinito do MP);
 * 5. atualiza o status do pagamento SEM alterar o status do agendamento (a
 *    confirmação do atendimento é exclusiva do fluxo manual de confirmação);
 * 6. entregas repetidas são no-op (idempotência).
 */
export async function processarWebhookMercadoPago(req: Request): Promise<ResultadoWebhookDTO> {
  const assinatura = validarAssinaturaWebhook(req);
  const dataId = assinatura.dataId; // agora é o PAYMENT id (type=payment)

  const tipo = typeof req.query.type === 'string' ? req.query.type : null;
  if (tipo !== 'payment') {
    console.log(`[webhook-mercadopago] tópico ignorado (type=${tipo ?? '(ausente)'})`);
    return { aceito: false, motivo: 'topico_ignorado' };
  }

  const pagamentoMp = await obterPayment(dataId);

  const externalReference = pagamentoMp.externalReference;
  if (!externalReference) {
    console.warn(
      `[webhook-mercadopago] resposta sem external_reference (paymentId=${dataId}) — 200 para evitar retry`,
    );
    return { aceito: false, motivo: 'sem_external_reference' };
  }

  // external_reference = id do nosso pagamento (gravado na criação).
  const pagamento = await buscarPagamentoPorId(externalReference);
  if (!pagamento) {
    console.warn(
      `[webhook-mercadopago] pagamento desconhecido no banco (externalReference=${externalReference}) — 200 para evitar retry`,
    );
    return { aceito: false, motivo: 'pagamento_desconhecido' };
  }

  const destino = mapearStatusPagamento(pagamentoMp);
  if (destino === null) {
    return { aceito: true, motivo: 'status_desconhecido' };
  }

  if (destino === 'aprovado') {
    const paymentId = extrairPaymentIdAprovado(pagamentoMp);
    if (!paymentId) {
      console.warn(
        `[webhook-mercadopago] payment approved sem accredited (paymentId=${dataId}) — estado atual mantido`,
      );
      return { aceito: false, motivo: 'sem_payment_accredited' };
    }

    await atualizarStatusPagamento(pagamento.id, 'aprovado', {
      mercadopagoPaymentId: paymentId,
    });
    return { aceito: true, status: 'aprovado' };
  }

  if (destino === 'cancelado' || destino === 'expirado' || destino === 'recusado') {
    await atualizarStatusPagamento(pagamento.id, destino);
    return { aceito: true, status: destino };
  }

  // destino === 'pendente': no-op.
  return { aceito: true, status: 'pendente' };
}

/**
 * Resolve o pagamento local e a resposta do MP usados na confirmação do
 * retorno, a partir do `paymentId` da URL (opcional):
 *
 * - com `paymentId`: consulta `GET /v1/payments/{id}` (404 do MP → NotFoundError
 *   opaco) e deriva o registro local pelo `external_reference` (id do nosso
 *   pagamento, mesmo padrão do webhook);
 * - sem `paymentId` (o MP não garante o parâmetro em todos os retornos): usa o
 *   pagamento local mais recente e busca no MP por `external_reference`
 *   (`GET /v1/payments/search`). Devolve `pagamentoMp: null` quando o MP ainda
 *   não conhece nenhum pagamento para aquela referência (front segue em
 *   polling).
 *
 * Segurança: o `paymentId` nunca é confiado; a autorização (cliente dono OU
 * admin) e a checagem de que o `external_reference` pertence ao agendamento são
 * feitas aqui, sem vazar dados (404 opaco).
 */
async function resolverPagamentoParaConfirmacao(
  agendamentoId: string,
  paymentId: string | null,
  maisRecente: PagamentoRow | null,
): Promise<{ pagamento: PagamentoRow; pagamentoMp: PagamentoMercadoPago | null }> {
  if (paymentId) {
    // paymentId vem da URL de retorno do MP → NÃO confiável. A fonte da verdade
    // é a API do MP (GET /v1/payments/{id}), mesmo método usado pelo webhook.
    let pagamentoMp: PagamentoMercadoPago;
    try {
      pagamentoMp = await obterPayment(paymentId);
    } catch (error) {
      // Pagamento inexistente no MP (404) → 404 opaco, MESMO tratamento do caso
      // de external_reference divergente (sem vazar o motivo). Qualquer outro
      // erro (rede/5xx) segue ao errorHandler como 500. O webhook NÃO passa por
      // aqui — `processarWebhookMercadoPago` mantém o comportamento atual.
      if (error instanceof ErroApiMercadoPago && error.status === 404) {
        throw new NotFoundError('Pagamento não encontrado');
      }
      throw error;
    }

    // Deriva o registro local pelo external_reference (id do nosso pagamento).
    const externalReference = pagamentoMp.externalReference;
    if (!externalReference) {
      throw new NotFoundError('Pagamento não encontrado');
    }
    const pagamento = await buscarPagamentoPorId(externalReference);
    if (!pagamento || pagamento.agendamento_id !== agendamentoId) {
      throw new NotFoundError('Pagamento não encontrado');
    }
    return { pagamento, pagamentoMp };
  }

  // Sem payment_id na URL: resolve pelo pagamento local mais recente e busca no
  // MP pela referência externa (mesmo id gravado na criação da preferência).
  if (!maisRecente) {
    throw new NotFoundError('Pagamento não encontrado');
  }
  const encontrados = await buscarPagamentosPorReferenciaExterna(maisRecente.id);
  if (encontrados.length === 0) {
    return { pagamento: maisRecente, pagamentoMp: null };
  }
  // A busca já vem ordenada por `date_created` desc; preferimos um pagamento
  // aprovado (pode haver tentativas recusadas anteriores) e caímos no mais
  // recente como fallback.
  const aprovado = encontrados.find((p) => p.status === 'approved') ?? null;
  return { pagamento: maisRecente, pagamentoMp: aprovado ?? encontrados[0] ?? null };
}

/**
 * Confirma de forma autoritativa e imediata o status de um pagamento no
 * retorno do Checkout Pro (POST /api/agendamentos/:id/pagamento/confirmar-retorno).
 *
 * Contexto: o frontend é redirecionado de volta pelo Mercado Pago (back_urls)
 * com o `payment_id` do pagamento na URL. O webhook pode atrasar ou falhar em
 * ambiente local, então este endpoint consulta a API do MP na hora — o
 * `payment_id` é tratado como NÃO CONFIÁVEL e a fonte da verdade é a resposta
 * do MP (mesmo método do webhook).
 *
 * Regras:
 * - autorização: cliente DONO do agendamento OU admin; outros → 403;
 * - agendamento inexistente → 404; registro local derivado pelo
 *   `external_reference` (id do nosso pagamento, mesmo padrão do webhook);
 *   external_reference ausente / pagamento desconhecido / agendamento
 *   divergente → 404 sem vazar dados (o `paymentId` pode ser de outro
 *   pagamento ou agendamento);
 * - `paymentId` OPCIONAL: sem ele, o pagamento é resolvido pela
 *   `external_reference` do pagamento local mais recente (busca no MP); sem
 *   pagamento local → 404; MP ainda sem pagamento registrado → devolve o estado
 *   local atual (front segue em polling);
 * - idempotente ANTES da chamada externa: se o pagamento mais recente do
 *   agendamento já está `aprovado`, retorna o estado atual (no-op) SEM
 *   consultar o Mercado Pago — refazer o retorno com o MP indisponível não
 *   devolve 500;
 * - paymentId inexistente no MP (404) → 404 opaco (`Pagamento não encontrado`),
 *   mesmo tratamento do caso de external_reference divergente; outros erros do
 *   MP (rede/5xx) seguem como 500;
 * - aprovado (approved+accredited) → atualiza SOMENTE o pagamento para
 *   `aprovado` (com `mercadopagoPaymentId`); o status do agendamento NÃO é
 *   alterado (confirmação é exclusiva do fluxo manual de confirmação);
 * - recusado/cancelado/expirado → atualiza o pagamento e retorna atualizado;
 * - pending/in_process/desconhecido → retorna o estado atual (front em polling).
 */
export async function confirmarRetorno(
  usuarioId: string,
  role: string,
  agendamentoId: string,
  paymentId?: string | null,
): Promise<PagamentoDTO> {
  if (role !== 'cliente' && role !== 'admin') {
    throw new ForbiddenError('Acesso negado');
  }

  const agendamento = await buscarAgendamentoPorId(agendamentoId);
  if (!agendamento) {
    throw new NotFoundError('Agendamento não encontrado');
  }
  if (role === 'cliente') {
    const cliente = await buscarClientePorUsuarioId(usuarioId);
    if (!cliente || cliente.id !== agendamento.cliente_id) {
      throw new ForbiddenError('Acesso negado');
    }
  }

  // Idempotência ANTES da chamada externa: se o pagamento mais recente do
  // agendamento já está aprovado, o retorno é um no-op — não consultamos o MP
  // (que pode estar indisponível) nem reescrevemos estado. Sem isso, refazer o
  // retorno com o MP fora do ar devolveria 500 em vez do estado aprovado local.
  const maisRecente = await buscarPorAgendamentoMaisRecente(agendamentoId);
  if (maisRecente?.status === 'aprovado') {
    return toPagamentoDTO(maisRecente);
  }

  const resolucao = await resolverPagamentoParaConfirmacao(
    agendamentoId,
    paymentId ?? null,
    maisRecente,
  );
  const { pagamento, pagamentoMp } = resolucao;

  if (pagamentoMp === null) {
    // MP ainda não conhece pagamento para esta referência → estado local atual.
    return toPagamentoDTO(pagamento);
  }

  // Idempotência: estado aprovado já gravado → no-op (retorna o estado atual).
  if (pagamento.status === 'aprovado') {
    return toPagamentoDTO(pagamento);
  }

  const destino = mapearStatusPagamento(pagamentoMp);
  if (destino === null) {
    // pending/in_process/desconhecido: estado atual — o front segue em polling.
    return toPagamentoDTO(pagamento);
  }

  if (destino === 'aprovado') {
    const paymentIdAprovado = extrairPaymentIdAprovado(pagamentoMp);
    if (!paymentIdAprovado) {
      // approved sem accredited → não é dinheiro confirmado (no-op).
      return toPagamentoDTO(pagamento);
    }
    await atualizarStatusPagamento(pagamento.id, 'aprovado', {
      mercadopagoPaymentId: paymentIdAprovado,
    });
    const atualizado = await buscarPagamentoPorId(pagamento.id);
    return toPagamentoDTO(atualizado ?? pagamento);
  }

  if (destino === 'recusado' || destino === 'cancelado' || destino === 'expirado') {
    await atualizarStatusPagamento(pagamento.id, destino);
    const atualizado = await buscarPagamentoPorId(pagamento.id);
    return toPagamentoDTO(atualizado ?? pagamento);
  }

  // destino === 'pendente': no-op.
  return toPagamentoDTO(pagamento);
}