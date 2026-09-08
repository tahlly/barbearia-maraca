import { Router } from 'express';
import { authenticate, authenticateOptional } from '../middlewares/authenticate';
import {
  listarHorarios,
  obterDisponibilidade,
  criarHorario,
  atualizarHorario,
  excluirHorario,
} from '../controllers/horario-controller';

const horarioRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     HorarioTrabalho:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         funcionario_id: { type: string }
 *         funcionario_nome: { type: string }
 *         dia_semana:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *           example: 1
 *         hora_inicio: { type: string, example: '09:00:00' }
 *         hora_fim: { type: string, example: '18:00:00' }
 *         ativo: { type: boolean }
 *         created_at: { type: string }
 *         updated_at: { type: string }
 *     CreateHorarioRequest:
 *       type: object
 *       required: [funcionario_id, dia_semana, hora_inicio, hora_fim]
 *       properties:
 *         funcionario_id: { type: string, format: uuid }
 *         dia_semana:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *         hora_inicio: { type: string, example: '09:00:00' }
 *         hora_fim: { type: string, example: '18:00:00' }
 *     UpdateHorarioRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         dia_semana:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *         hora_inicio: { type: string, example: '09:00:00' }
 *         hora_fim: { type: string, example: '18:00:00' }
 *     Disponibilidade:
 *       type: object
 *       additionalProperties: true
 *
 * /api/horarios/funcionario-disponibilidade:
 *   get:
 *     tags: [Horarios]
 *     summary: Obtem disponibilidade de horarios de um funcionario (publico)
 *     parameters:
 *       - in: query
 *         name: funcionario_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: data
 *         required: false
 *         schema: { type: string, format: date }
 *     responses:
 *       '200':
 *         description: Disponibilidade
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Disponibilidade'
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *
 * /api/horarios:
 *   get:
 *     tags: [Horarios]
 *     summary: Lista horarios de trabalho
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: funcionario_id
 *         required: false
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: dia_semana
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *     responses:
 *       '200':
 *         description: Lista de horarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/HorarioTrabalho' }
 *   post:
 *     tags: [Horarios]
 *     summary: Cria um horario de trabalho
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateHorarioRequest' }
 *     responses:
 *       '201':
 *         description: Horario criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/HorarioTrabalho' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *
 * /api/horarios/{id}:
 *   put:
 *     tags: [Horarios]
 *     summary: Atualiza um horario de trabalho
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
 *           schema: { $ref: '#/components/schemas/UpdateHorarioRequest' }
 *     responses:
 *       '200':
 *         description: Horario atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/HorarioTrabalho' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *   delete:
 *     tags: [Horarios]
 *     summary: Exclui um horario de trabalho
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '204':
 *         description: Horario excluido
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 */

// Disponibilidade é pública (horários de funcionamento + slots ocupados) para
// permitir o booking wizard sem login. Registrada antes do `use(authenticate)`
// para não exigir token; se houver token válido, o usuário é anexado ao request.
horarioRoutes.get('/funcionario-disponibilidade', authenticateOptional, obterDisponibilidade);

// Aplicar autenticação no restante do domínio de horários (os RBACs de agenda
// são aplicados no service/controller, conforme o papel do usuário autenticado).
horarioRoutes.use(authenticate);

horarioRoutes.get('/', listarHorarios);
horarioRoutes.post('/', criarHorario);
horarioRoutes.put('/:id', atualizarHorario);
horarioRoutes.delete('/:id', excluirHorario);

export default horarioRoutes;
