import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { requerPermissao } from '../middlewares/requerPermissao';
import { graficosHandler } from '../controllers/dashboard-controller';

const dashboardRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     DashboardGraficos:
 *       type: object
 *       required: [inicio, fim, distribuicaoStatus, agendamentosPorDia, horariosPico, servicosMaisVendidos]
 *       properties:
 *         inicio: { type: string, format: date }
 *         fim: { type: string, format: date }
 *         distribuicaoStatus:
 *           type: object
 *           required: [pendente, confirmado, cancelado, concluido]
 *           properties:
 *             pendente: { type: integer, example: 2 }
 *             confirmado: { type: integer, example: 5 }
 *             cancelado: { type: integer, example: 1 }
 *             concluido: { type: integer, example: 8 }
 *           description: >
 *             Contagem BRUTA por status do enum `status_agendamento`; o mapa SEMPRE
 *             contém as 4 chaves (status sem agendamento vêm com 0). NÃO agrupa
 *             status visualmente (ex.: confirmado + pendente) — a decisão de
 *             renderização é do Frontend.
 *         agendamentosPorDia:
 *           type: object
 *           required: [inicio, fim, dias]
 *           properties:
 *             inicio: { type: string, format: date }
 *             fim: { type: string, format: date }
 *             dias:
 *               type: array
 *               items:
 *                 type: object
 *                 required: [data, quantidade]
 *                 properties:
 *                   data: { type: string, format: date }
 *                   quantidade: { type: integer, example: 3 }
 *               description: Todos os dias da janela, com zero para dias sem agendamento.
 *         horariosPico:
 *           type: array
 *           items:
 *             type: object
 *             required: [hora, quantidade]
 *             properties:
 *               hora: { type: string, example: '09:30', description: 'HH:MM real da coluna hora (time), sem arredondar.' }
 *               quantidade: { type: integer, example: 4 }
 *         servicosMaisVendidos:
 *           type: array
 *           items:
 *             type: object
 *             required: [servicoId, servicoNome, quantidade]
 *             properties:
 *               servicoId: { type: string, format: uuid }
 *               servicoNome: { type: string }
 *               quantidade: { type: integer, example: 6 }
 *           description: Agendamentos CONCLUÍDOS por serviço, do mais vendido.
 *
 * /api/dashboard/graficos:
 *   get:
 *     tags: [Dashboard]
 *     summary: Graficos do Dashboard (requer permissao ver_financeiro).
 *     description: >
 *       Acesso restrito a quem possui a permissao efetiva `ver_financeiro`
 *       (admin por padrao; overrides no banco contam). Recepcionista sem a
 *       permissao recebe 403.
 *
 *       O período base (`inicio`/`fim`, default ano corrente) rege a
 *       Distribuicao por status, os Horarios de pico e os Servicos mais
 *       vendidos. O grafico de Agendamentos por dia usa a janela propria
 *       `dias` (7 ou 30), terminando em hoje.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: inicio
 *         required: false
 *         schema: { type: string, format: date }
 *         description: Data inicial do periodo base (YYYY-MM-DD); se ausente, primeiro dia do ano corrente.
 *       - in: query
 *         name: fim
 *         required: false
 *         schema: { type: string, format: date }
 *         description: Data final do periodo base (YYYY-MM-DD); se ausente, ultimo dia do ano corrente.
 *       - in: query
 *         name: dias
 *         required: false
 *         schema: { type: integer, enum: [7, 30], default: 7 }
 *         description: Janela (em dias) do grafico de agendamentos por dia, terminando em hoje.
 *     responses:
 *       '200':
 *         description: Agrupamentos dos 4 graficos do Dashboard
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DashboardGraficos' }
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 */

// Negação por padrão: qualquer usuário autenticado, mas apenas quem tem a
// permissão efetiva `ver_financeiro` chega ao controller (403 caso contrário).
dashboardRoutes.get('/graficos', authenticate, requerPermissao('ver_financeiro'), graficosHandler);

export default dashboardRoutes;