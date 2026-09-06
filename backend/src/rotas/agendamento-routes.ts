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
 *
 * /api/agendamentos:
 *   post:
 *     tags: [Agendamentos]
 *     summary: Cria um agendamento
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
 */

agendamentoRoutes.post('/', authenticate, criarHandler);
agendamentoRoutes.get('/', authenticate, listarHandler);
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

export default agendamentoRoutes;
