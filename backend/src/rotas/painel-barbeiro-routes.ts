import { Router } from 'express';
import { authorize } from '../middlewares/authorize';
import { painelBarbeiroHandler } from '../controllers/painel-barbeiro-controller';

const painelBarbeiroRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     PainelBarbeiroComissao:
 *       type: object
 *       required: [valorAtual, mesAnterior, variacaoPercentual]
 *       properties:
 *         valorAtual:
 *           type: string
 *           example: '142.50'
 *           description: Comissao acumulada no mes corrente (string decimal).
 *         mesAnterior:
 *           type: string
 *           example: '130.00'
 *           description: Comissao do mes civil anterior (string decimal).
 *         variacaoPercentual:
 *           type: string
 *           nullable: true
 *           example: '9.62'
 *           description: Variacao relativa em % (2 casas, sinal). null sem base (mes anterior zero).
 *     PainelBarbeiro:
 *       type: object
 *       required: [atendimentosMes, comissaoMes, atendimentosPorDia, servicosMaisFeitos, horariosMaisConcorridos]
 *       properties:
 *         atendimentosMes:
 *           type: integer
 *           example: 12
 *           description: Atendimentos concluidos pelo proprio profissional no mes corrente.
 *         comissaoMes:
 *           oneOf:
 *             - $ref: '#/components/schemas/PainelBarbeiroComissao'
 *             - { type: 'null' }
 *           description: null quando comissao_ativa=false (card nao aparece).
 *         atendimentosPorDia:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               data: { type: string, format: date, example: '2026-09-06' }
 *               quantidade: { type: integer, example: 2 }
 *           description: Ultimos 7 dias terminando em hoje (zeros preenchidos).
 *         servicosMaisFeitos:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               servicoId: { type: string, format: uuid }
 *               servicoNome: { type: string, example: 'Corte' }
 *               quantidade: { type: integer, example: 8 }
 *         horariosMaisConcorridos:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               hora: { type: string, example: '09:30' }
 *               quantidade: { type: integer, example: 5 }
 *
 * /api/painel-barbeiro:
 *   get:
 *     tags: [Painel do Barbeiro]
 *     summary: Painel pessoal do profissional (5 elementos do Meu Painel em uma resposta)
 *     description: >
 *       Retorna atendimentos do mes, comissao propria (condicional a
 *       comissao_ativa), atendimentos por dia (7 dias), servicos mais feitos e
 *       horarios mais concorridos — SEMPRE filtrado exclusivamente pelo
 *       profissional logado. Nao exige ver_financeiro: comissao propria e dado
 *       pessoal do profissional.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Painel do barbeiro
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PainelBarbeiro' }
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 */

painelBarbeiroRoutes.get('/', authorize('profissional'), painelBarbeiroHandler);

export default painelBarbeiroRoutes;