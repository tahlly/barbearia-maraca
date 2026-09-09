import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import {
  criarHandler,
  listarHandler,
  obterHandler,
  cancelarHandler,
  confirmarHandler,
  concluirHandler,
  reverterHandler,
  faturamentoHandler,
} from '../controllers/agendamento-controller';

const agendamentoRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     AgendamentoStatus:
 *       type: string
 *       enum: [pendente, confirmado, cancelado, concluido]
 *     Agendamento:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         clienteId: { type: string }
 *         clienteNome: { type: string, nullable: true }
 *         funcionarioId: { type: string }
 *         funcionarioNome: { type: string, nullable: true }
 *         servicoId: { type: string }
 *         servicoNome: { type: string, nullable: true }
 *         data: { type: string, format: date }
 *         hora: { type: string, example: '09:00' }
 *         status:
 *           $ref: '#/components/schemas/AgendamentoStatus'
 *         observacao: { type: string, nullable: true }
 *         pessoaAtendidaNome: { type: string, nullable: true }
 *         criadoEm: { type: string }
 *     CreateAgendamentoRequest:
 *       type: object
 *       required: [funcionario_id, servico_id, data, hora]
 *       properties:
 *         funcionario_id: { type: string, format: uuid }
 *         servico_id: { type: string, format: uuid }
 *         data: { type: string, format: date }
 *         hora: { type: string, example: '09:00' }
 *         observacao: { type: string, nullable: true }
 *         pessoa_atendida_nome: { type: string, nullable: true }
 *         cliente_id:
 *           type: string
 *           format: uuid
 *           description: Obrigatório quando o solicitante é recepcionista/admin (agenda em nome do cliente). Ignorado para o papel cliente.
 *
 * /api/agendamentos:
 *   post:
 *     tags: [Agendamentos]
 *     summary: Cria um agendamento (cliente agenda para si; recepcionista/admin informam cliente_id)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateAgendamentoRequest' }
 *     responses:
 *       '201':
 *         description: Agendamento criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Agendamento' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *   get:
 *     tags: [Agendamentos]
 *     summary: Lista agendamentos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: data
 *         required: false
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           $ref: '#/components/schemas/AgendamentoStatus'
 *     responses:
 *       '200':
 *         description: Lista de agendamentos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Agendamento' }
 *
 * /api/agendamentos/{id}:
 *   get:
 *     tags: [Agendamentos]
 *     summary: Obtem um agendamento
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Agendamento encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Agendamento' }
 *       '404':
 *         $ref: '#/components/responses/Erro404'
 *
 * /api/agendamentos/{id}/cancelar:
 *   patch:
 *     tags: [Agendamentos]
 *     summary: Cancela um agendamento
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Agendamento cancelado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Agendamento' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *
 * /api/agendamentos/{id}/confirmar:
 *   patch:
 *     tags: [Agendamentos]
 *     summary: Confirma um agendamento (profissional/recepcionista/admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Agendamento confirmado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Agendamento' }
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/agendamentos/{id}/concluir:
 *   patch:
 *     tags: [Agendamentos]
 *     summary: Conclui um agendamento (profissional/recepcionista/admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Agendamento concluido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Agendamento' }
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/agendamentos/{id}/reverter:
 *   patch:
 *     tags: [Agendamentos]
 *     summary: Reverte a conclusao de um agendamento para confirmado (profissional/recepcionista/admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Agendamento revertido para confirmado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Agendamento' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/agendamentos/faturamento:
 *   get:
 *     tags: [Agendamentos]
 *     summary: Resumo de faturamento em um periodo (agendamentos concluidos). Profissional ve sua propria agenda; admin ve todos; recepcionista/cliente nao acessam.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: inicio
 *         required: false
 *         schema: { type: string, format: date }
 *         description: Data inicial do periodo (YYYY-MM-DD); se ausente, primeiro dia do ano corrente.
 *       - in: query
 *         name: fim
 *         required: false
 *         schema: { type: string, format: date }
 *         description: Data final do periodo (YYYY-MM-DD); se ausente, ultimo dia do ano corrente.
 *     responses:
 *       '200':
 *         description: Resumo do faturamento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inicio: { type: string, format: date }
 *                 fim: { type: string, format: date }
 *                 valorTotal: { type: string, example: '180.00' }
 *                 quantidade: { type: integer, example: 12 }
 *                 ticketMedio: { type: string, example: '15.00' }
 *                 porServico:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       servicoId: { type: string, format: uuid }
 *                       servicoNome: { type: string }
 *                       quantidade: { type: integer }
 *                       valorTotal: { type: string, example: '90.00' }
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 */

agendamentoRoutes.post('/', authenticate, criarHandler);
agendamentoRoutes.get('/', authenticate, listarHandler);
/* `/faturamento` precisa vir antes de `/:id` para não ser capturado como uuid. */
agendamentoRoutes.get(
  '/faturamento',
  authorize('profissional', 'admin'),
  faturamentoHandler,
);
agendamentoRoutes.get('/:id', authenticate, obterHandler);
agendamentoRoutes.patch('/:id/cancelar', authenticate, cancelarHandler);
agendamentoRoutes.patch(
  '/:id/confirmar',
  authorize('profissional', 'recepcionista', 'admin'),
  confirmarHandler,
);
agendamentoRoutes.patch(
  '/:id/concluir',
  authorize('profissional', 'recepcionista', 'admin'),
  concluirHandler,
);
agendamentoRoutes.patch(
  '/:id/reverter',
  authorize('profissional', 'recepcionista', 'admin'),
  reverterHandler,
);

export default agendamentoRoutes;
