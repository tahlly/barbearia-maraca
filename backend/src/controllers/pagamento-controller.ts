import type { Request, Response } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import {
  cancelarPagamentoPendente,
  confirmarRetorno,
  criarPagamento,
  criarPagamentoComCartao,
  obterPagamento,
  processarWebhookMercadoPago,
} from '../services/pagamento-service';

const idSchema = z.string().uuid('id deve ser um UUID');

/**
 * Corpo do Card Payment Brick (Checkout Bricks). Apenas o token de cartão e
 * os dados do pagador trafegam neste contrato; `transaction_amount` e
 * parcelas NÃO são aceitos do cliente — o backend usa o valor do banco.
 */
const cartaoSchema = z.object({
  token: z.string().min(1, 'Token do cartão é obrigatório'),
  paymentMethodId: z.string().min(1, 'payment_method_id é obrigatório'),
  payer: z.object({
    email: z.string().email('E-mail do pagador é obrigatório'),
    firstName: z.string().max(100).optional().nullable(),
    lastName: z.string().max(100).optional().nullable(),
    identification: z
      .object({
        type: z.string().min(1, 'Tipo de identificação é obrigatório'),
        number: z.string().min(1, 'Número de identificação é obrigatório'),
      })
      .optional()
      .nullable(),
  }),
});

/**
 * Corpo do retorno do Checkout Pro: `payment_id` trazido na URL de retorno do
 * Mercado Pago. É tratado como NÃO CONFIAVEL — a fonte da verdade é a API do
 * MP (GET /v1/payments/{id}), consultada pelo service.
 */
const confirmarRetornoSchema = z.object({
  // Opcional: o MP não garante `payment_id` em todos os retornos; sem ele o
  // service resolve o pagamento pela `external_reference` local (ver service).
  paymentId: z.string().min(1, 'payment_id não pode ser vazio').optional(),
});

function exigirUsuario(req: Request): { id: string; role: string } {
  const user = req.user;
  if (!user) {
    // A rota deveria estar protegida pelo middleware authenticate; nega por
    // padrão caso alguém monte a rota sem ele.
    throw new UnauthorizedError('Não autenticado');
  }
  return { id: user.id, role: user.role };
}

/**
 * POST /api/agendamentos/:id/pagamento
 * Cria (ou reutiliza) o pagamento. Retorna a checkout URL do Mercado Pago
 * (pode ser null — coluna `checkout_url`, migration 20260913000002).
 */
export async function criarPagamentoHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const resultado = await criarPagamento(user.id, user.role, id);
  res.status(200).json({ checkoutUrl: resultado.checkoutUrl, pagamento: resultado.pagamento });
}

/**
 * GET /api/agendamentos/:id/pagamento
 * Sempre 200 com `{ pagamento: PagamentoDTO | null }` — o front usa para
 * polling do status sem precisar tratar 204.
 */
export async function obterPagamentoHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const pagamento = await obterPagamento(user.id, user.role, id);
  res.status(200).json({ pagamento });
}

/**
 * POST /api/agendamentos/:id/pagamento/cartao
 * Cobra no cartão usando o token gerado pelo Card Payment Brick. Retorna
 * `{ status, pagamento }`: status aprovado/recusado/cancelado/expirado após
 * a resposta síncrona do MP; pendente quando o MP retorna estado
 * intermediário (o webhook ou o retorno do Checkout Pro atualiza depois).
 * Pagamento aprovado NÃO altera o status do agendamento.
 */
export async function criarPagamentoCartaoHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const body = cartaoSchema.parse(req.body);
  const resultado = await criarPagamentoComCartao(user.id, user.role, id, body);
  res.status(200).json(resultado);
}

/**
 * POST /api/agendamentos/:id/pagamento/confirmar-retorno
 * No retorno do Checkout Pro (Mercado Pago), o frontend chama este endpoint
 * para confirmar o pagamento de forma autoritativa e imediata (sem depender
 * do webhook). `paymentId` vem da URL de retorno e é tratado como não
 * confiável — o service consulta a API do MP. Responde `{ pagamento }`.
 */
export async function confirmarRetornoHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const body = confirmarRetornoSchema.parse(req.body);
  const pagamento = await confirmarRetorno(user.id, user.role, id, body.paymentId);
  res.status(200).json({ pagamento });
}

/**
 * POST /api/agendamentos/:id/pagamento/cancelar
 * Cancela o pagamento PENDENTE mais recente quando o cliente DESISTE no
 * checkout do Mercado Pago. Idempotente, corpo vazio e SEMPRE 200 com
 * `{ pagamento: PagamentoDTO | null }` — nunca altera o status do agendamento
 * (rota separada do fluxo de cancelamento de agendamento).
 */
export async function cancelarPagamentoHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const pagamento = await cancelarPagamentoPendente(user.id, user.role, id);
  res.status(200).json({ pagamento });
}

/**
 * POST /api/webhooks/mercadopago
 * Público (sem authenticate): a segurança vem da assinatura HMAC validada no
 * service. Sempre responde 200 quando a assinatura é válida (idempotência).
 */
export async function webhookMercadoPagoHandler(req: Request, res: Response): Promise<void> {
  const resultado = await processarWebhookMercadoPago(req);
  res.status(200).json(resultado);
}