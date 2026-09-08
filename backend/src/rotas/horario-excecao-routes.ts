import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import {
  listarExcecoes,
  criarExcecao,
  atualizarExcecao,
  excluirExcecao,
} from '../controllers/horario-excecao-controller';

const horarioExcecaoRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     HorarioExcecao:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         funcionario_id: { type: string }
 *         funcionario_nome: { type: string }
 *         data: { type: string, example: '2026-09-12' }
 *         hora_inicio: { type: string, example: '09:00' }
 *         hora_fim: { type: string, example: '18:00' }
 *         tipo:
 *           type: string
 *           enum: [bloqueio, liberacao]
 *         motivo: { type: string, nullable: true }
 *         created_at: { type: string }
 *         updated_at: { type: string }
 *     CreateHorarioExcecaoRequest:
 *       type: object
 *       required: [funcionario_id, data, hora_inicio, hora_fim, tipo]
 *       properties:
 *         funcionario_id: { type: string, format: uuid }
 *         data: { type: string, format: date, example: '2026-09-12' }
 *         hora_inicio: { type: string, example: '09:00' }
 *         hora_fim: { type: string, example: '18:00' }
 *         tipo:
 *           type: string
 *           enum: [bloqueio, liberacao]
 *         motivo: { type: string }
 *     UpdateHorarioExcecaoRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         data: { type: string, format: date, example: '2026-09-12' }
 *         hora_inicio: { type: string, example: '09:00' }
 *         hora_fim: { type: string, example: '18:00' }
 *         tipo:
 *           type: string
 *           enum: [bloqueio, liberacao]
 *         motivo: { type: string, nullable: true }
 *
 * /api/horario-excecoes:
 *   get:
 *     tags: [ExcecoesHorario]
 *     summary: Lista excecoes de horario (profissional/recepcionista/admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: funcionario_id
 *         required: false
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: data
 *         required: false
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: tipo
 *         required: false
 *         schema:
 *           type: string
 *           enum: [bloqueio, liberacao]
 *     responses:
 *       '200':
 *         description: Lista de excecoes de horario
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/HorarioExcecao' }
 *   post:
 *     tags: [ExcecoesHorario]
 *     summary: Cria uma excecao de horario
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateHorarioExcecaoRequest' }
 *     responses:
 *       '201':
 *         description: Excecao criada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/HorarioExcecao' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *
 * /api/horario-excecoes/{id}:
 *   put:
 *     tags: [ExcecoesHorario]
 *     summary: Atualiza uma excecao de horario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateHorarioExcecaoRequest' }
 *     responses:
 *       '200':
 *         description: Excecao atualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/HorarioExcecao' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *   delete:
 *     tags: [ExcecoesHorario]
 *     summary: Exclui uma excecao de horario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '204':
 *         description: Excecao excluida
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 */

// Todas as rotas de exceções de horário exigem autenticação. Os RBACs de
// agenda (profissional só na própria agenda; recepcionista/admin em qualquer;
// cliente sem acesso) são aplicados no service/controller.
horarioExcecaoRoutes.use(authenticate);

horarioExcecaoRoutes.get('/', listarExcecoes);
horarioExcecaoRoutes.post('/', criarExcecao);
horarioExcecaoRoutes.put('/:id', atualizarExcecao);
horarioExcecaoRoutes.delete('/:id', excluirExcecao);

export default horarioExcecaoRoutes;
