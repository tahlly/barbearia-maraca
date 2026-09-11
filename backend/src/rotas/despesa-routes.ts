import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { requerPermissao } from '../middlewares/requerPermissao';
import { resumoHandler } from '../controllers/despesa-controller';

const despesaRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     DespesaResumo:
 *       type: object
 *       required: [inicio, fim, despesaTotal]
 *       properties:
 *         inicio: { type: string, format: date }
 *         fim: { type: string, format: date }
 *         despesaTotal: { type: string, example: '57.50' }
 *
 * /api/despesas/resumo:
 *   get:
 *     tags: [Despesas]
 *     summary: Soma as despesas de um periodo (requer permissao ver_financeiro).
 *     description: >
 *       Acesso restrito a quem possui a permissao efetiva `ver_financeiro`
 *       (admin por padrao; overrides no banco contam). Recepcionista sem a
 *       permissao recebe 403. Apenas leitura/soma — CRUD e rodada futura.
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
 *         description: Soma das despesas no periodo (string decimal normalizada)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DespesaResumo' }
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 */

// Negação por padrão: qualquer usuário autenticado, mas apenas quem tem a
// permissão efetiva `ver_financeiro` chega ao controller (403 caso contrário).
despesaRoutes.get('/resumo', authenticate, requerPermissao('ver_financeiro'), resumoHandler);

export default despesaRoutes;
