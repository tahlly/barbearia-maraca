import { Router } from 'express';
import { webhookMercadoPagoHandler } from '../controllers/pagamento-controller';

const webhookRoutes = Router();

/**
 * @openapi
 * /api/webhooks/mercadopago:
 *   post:
 *     tags: [Webhooks]
 *     summary: Webhook do Mercado Pago (Checkout Pro — Preferences API). Publico; a seguranca vem da assinatura HMAC (x-signature).
 *     description: Escuta apenas eventos type=payment. Valida assinatura (401 se inválida), consulta o pagamento na API do MP (GET /v1/payments/{id}, não confia no corpo) e atualiza o status do pagamento quando aprovado e creditado — SEM alterar o status do agendamento, cuja confirmação é exclusiva do fluxo manual. Idempotente; entregas repetidas respondem 200 sem erro.
 *     responses:
 *       '200':
 *         description: Evento processado ou ignorado com segurança (evita retry infinito)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 aceito: { type: boolean }
 *                 motivo: { type: string, nullable: true }
 *                 status:
 *                   $ref: '#/components/schemas/PagamentoStatus'
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 */

webhookRoutes.post('/mercadopago', webhookMercadoPagoHandler);

export default webhookRoutes;