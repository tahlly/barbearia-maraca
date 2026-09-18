import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import {
  cancelarPagamentoHandler,
  confirmarRetornoHandler,
  criarPagamentoHandler,
  criarPagamentoCartaoHandler,
  obterPagamentoHandler,
} from '../controllers/pagamento-controller';

const pagamentoRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     PagamentoStatus:
 *       type: string
 *       enum: [pendente, aprovado, recusado, cancelado, expirado]
 *     Pagamento:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         agendamentoId: { type: string, format: uuid }
 *         status:
 *           $ref: '#/components/schemas/PagamentoStatus'
 *         valorCentavos: { type: integer, example: 4500 }
 *         mercadopagoOrderId: { type: string, nullable: true, description: 'Id da ordem no Mercado Pago. null quando o pagamento é presencial (sem ordem MP).' }
 *         mercadopagoPaymentId: { type: string, nullable: true }
 *         checkoutUrl: { type: string, nullable: true }
 *         criadoEm: { type: string }
 *         atualizadoEm: { type: string }
 *
 * /api/agendamentos/{id}/pagamento:
 *   post:
 *     tags: [Agendamentos]
 *     summary: Cria (ou reutiliza) o pagamento de um agendamento via Mercado Pago Checkout Pro (Preferences API). Somente o cliente dono do agendamento.
 *     description: Retorna a init_point do Mercado Pago como checkoutUrl (pode ser null — coluna `checkout_url`, migration 20260913000002) e o pagamento criado/reutilizado. Se já existir pagamento pendente, reutiliza sem chamar o MP.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Checkout criado ou reutilizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 checkoutUrl: { type: string, nullable: true, description: 'URL do Checkout Pro. null quando indisponível ou reuso sem URL persistida.' }
 *                 pagamento:
 *                   $ref: '#/components/schemas/Pagamento'
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '404':
 *         $ref: '#/components/responses/Erro404'
 *   get:
 *     tags: [Agendamentos]
 *     summary: Obtem o pagamento mais recente do agendamento (cliente dono ou admin). Sempre 200; pagamento null quando nao existe (polling do frontend).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Pagamento mais recente (ou null)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pagamento:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Pagamento'
 *                     - nullable: true
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '404':
 *         $ref: '#/components/responses/Erro404'
 * /api/agendamentos/{id}/pagamento/confirmar-retorno:
 *   post:
 *     tags: [Agendamentos]
 *     summary: Confirma o status do pagamento no retorno do Checkout Pro (cliente dono ou admin). Consulta a API do Mercado Pago de forma autoritativa e imediata — o payment_id da URL de retorno é tratado como não confiável; quando ausente, o pagamento é resolvido pela external_reference local.
 *     description: Idempotente (pagamento já aprovado → no-op). Aprovado (approved+accredited) atualiza SOMENTE o pagamento — NÃO altera o status do agendamento, cuja confirmação é exclusiva do fluxo manual. Recusado/cancelado/expirado atualiza o pagamento; pending/in_process/desconhecido mantém o estado atual (front segue em polling).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentId: { type: string, description: 'payment_id trazido na URL de retorno do Checkout Pro (não confiável). Opcional: sem ele, o pagamento é resolvido pela external_reference local via busca no MP.' }
*     responses:
  *       '200':
  *         description: Pagamento confirmado ou estado atual (idempotente)
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 pagamento:
  *                   $ref: '#/components/schemas/Pagamento'
  *       '400':
  *         $ref: '#/components/responses/Erro400'
  *       '401':
  *         $ref: '#/components/responses/Erro401'
  *       '403':
  *         $ref: '#/components/responses/Erro403'
  *       '404':
  *         $ref: '#/components/responses/Erro404'
  * /api/agendamentos/{id}/pagamento/cancelar:
  *   post:
  *     tags: [Agendamentos]
  *     summary: Cancela o pagamento PENDENTE mais recente quando o cliente desiste no checkout do Mercado Pago (cliente dono ou admin). NUNCA altera o status do agendamento.
  *     description: 'Idempotente, corpo vazio e nunca chama o Mercado Pago. Pendente → cancelado (a listagem do cliente passa a exibir badge PAGAMENTO CANCELADO e oculta o botão PAGAR); aprovado → no-op (jamais desfaz aprovado); já cancelado/recusado/expirado → no-op; sem pagamento → pagamento null na resposta. Rota separada do fluxo de cancelamento de agendamento.'
  *     security:
  *       - bearerAuth: []
  *     parameters:
  *       - in: path
  *         name: id
  *         required: true
  *         schema: { type: string, format: uuid }
  *     responses:
  *       '200':
  *         description: Pagamento cancelado ou estado atual (idempotente)
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 pagamento:
  *                   allOf:
  *                     - $ref: '#/components/schemas/Pagamento'
  *                     - nullable: true
  *       '400':
  *         $ref: '#/components/responses/Erro400'
  *       '401':
  *         $ref: '#/components/responses/Erro401'
  *       '403':
  *         $ref: '#/components/responses/Erro403'
  *       '404':
  *         $ref: '#/components/responses/Erro404'
  * /api/agendamentos/{id}/pagamento/cartao:
 *   post:
 *     tags: [Agendamentos]
 *     summary: Cobra no cartão via Checkout Bricks (Card Payment Brick) — token gerado no navegador, processado pelo POST /v1/payments do Mercado Pago. Somente o cliente dono do agendamento.
 *     description: Retorna { status, pagamento }. Status aprovado atualiza SOMENTE o pagamento (não altera o status do agendamento — confirmação é exclusiva do fluxo manual); recusado/cancelado/expirado atualiza o pagamento; pendente aguarda o webhook ou o retorno do Checkout Pro. transaction_amount vem do banco (nunca do cliente) e parcelas são fixas em 1.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, paymentMethodId, payer]
 *             properties:
 *               token: { type: string, description: 'Token de cartão gerado pelo Brick' }
 *               paymentMethodId: { type: string, description: 'payment_method_id do cartão (bandeira)' }
 *               payer:
 *                 type: object
 *                 required: [email]
 *                 properties:
 *                   email: { type: string, format: email }
 *                   firstName: { type: string, nullable: true }
 *                   lastName: { type: string, nullable: true }
 *                   identification:
 *                     type: object
 *                     properties:
 *                       type: { type: string, example: CPF }
 *                       number: { type: string }
 *     responses:
 *       '200':
 *         description: Cobrança processada (status síncrono do MP)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/PagamentoStatus'
 *                 pagamento:
 *                   $ref: '#/components/schemas/Pagamento'
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '404':
 *         $ref: '#/components/responses/Erro404'
 */

pagamentoRoutes.post('/:id/pagamento', authenticate, criarPagamentoHandler);
pagamentoRoutes.post('/:id/pagamento/cartao', authenticate, criarPagamentoCartaoHandler);
pagamentoRoutes.post(
  '/:id/pagamento/confirmar-retorno',
  authenticate,
  confirmarRetornoHandler,
);
pagamentoRoutes.post('/:id/pagamento/cancelar', authenticate, cancelarPagamentoHandler);
pagamentoRoutes.get('/:id/pagamento', authenticate, obterPagamentoHandler);

export default pagamentoRoutes;