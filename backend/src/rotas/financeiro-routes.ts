import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { requerPermissao } from '../middlewares/requerPermissao';
import { resumoFinanceiroHandler } from '../controllers/resumo-financeiro-controller';

const financeiroRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     ComparativoMensal:
 *       type: object
 *       required: [periodoAtual, periodoAnterior, variacaoReceitaPercentual, variacaoDespesaPercentual, variacaoLucroPercentual, variacaoMargemPontosPercentuais]
 *       properties:
 *         periodoAtual:
 *           type: object
 *           required: [inicio, fim]
 *           properties:
 *             inicio: { type: string, format: date }
 *             fim: { type: string, format: date }
 *         periodoAnterior:
 *           type: object
 *           required: [inicio, fim]
 *           properties:
 *             inicio: { type: string, format: date }
 *             fim: { type: string, format: date }
 *         variacaoReceitaPercentual:
 *           type: string
 *           nullable: true
 *           example: '12.50'
 *           description: Variação RELATIVA da receita em % (null quando o período anterior é zero — sem base de comparação).
 *         variacaoDespesaPercentual:
 *           type: string
 *           nullable: true
 *           example: '-3.20'
 *         variacaoLucroPercentual:
 *           type: string
 *           nullable: true
 *           example: '25.00'
 *         variacaoMargemPontosPercentuais:
 *           type: string
 *           nullable: true
 *           example: '2.10'
 *           description: Diferença de margem em PONTOS PERCENTUAIS (margemAtual − margemAnterior). A margem já é percentual; variação relativa distorceria a leitura.
 *     EvolucaoMensal:
 *       type: object
 *       required: [mes, receita, despesa, lucro]
 *       properties:
 *         mes: { type: string, example: '2026-09' }
 *         receita: { type: string, example: '45.90' }
 *         despesa: { type: string, example: '12.00' }
 *         lucro: { type: string, example: '33.90' }
 *     DespesaPorCategoria:
 *       type: object
 *       required: [tipo_despesa, valor]
 *       properties:
 *         tipo_despesa: { type: string, enum: [fixa, variavel, comissao, outro] }
 *         valor: { type: string, example: '30.00' }
 *     ReceitaRealizadaPrevista:
 *       type: object
 *       required: [semanaInicio, realizada, prevista]
 *       properties:
 *         semanaInicio: { type: string, format: date, description: 'Segunda-feira da semana (YYYY-MM-DD).' }
 *         realizada: { type: string, example: '45.90' }
 *         prevista: { type: string, example: '100.00' }
 *     ResumoFinanceiro:
 *       type: object
 *       required: [inicio, fim, kpis, comparativoMensal, evolucaoMensal, despesasPorCategoria, receitaRealizadaPrevista]
 *       properties:
 *         inicio: { type: string, format: date }
 *         fim: { type: string, format: date }
 *         kpis:
 *           type: object
 *           required: [receita, despesa, lucroLiquido, margem]
 *           properties:
 *             receita: { type: string, example: '200.00' }
 *             despesa: { type: string, example: '57.50' }
 *             lucroLiquido: { type: string, example: '142.50' }
 *             margem: { type: string, example: '71.25' }
 *         comparativoMensal: { $ref: '#/components/schemas/ComparativoMensal' }
 *         evolucaoMensal:
 *           type: array
 *           items: { $ref: '#/components/schemas/EvolucaoMensal' }
 *         despesasPorCategoria:
 *           type: array
 *           items: { $ref: '#/components/schemas/DespesaPorCategoria' }
 *         receitaRealizadaPrevista:
 *           type: array
 *           items: { $ref: '#/components/schemas/ReceitaRealizadaPrevista' }
 *
 * /api/financeiro/resumo:
 *   get:
 *     tags: [Financeiro]
 *     summary: Resumo financeiro completo da tela Financeiro › Resumo (requer permissao ver_financeiro).
 *     description: >
 *       Acesso restrito a quem possui a permissao efetiva `ver_financeiro`
 *       (admin por padrao; overrides no banco contam). Recepcionista sem a
 *       permissao recebe 403 — e, mesmo com override, permanece negado porque
 *       o bloco reusa o resumo de faturamento (regra existente).
 *
 *       Resposta única com todos os blocos da tela:
 *       - `kpis`: Receita, Despesas, Lucro Liquido e Margem do período;
 *       - `comparativoMensal`: mesmo período vs. o equivalente anterior
 *         (mesma duração em dias, imediatamente antes), com variações em %;
 *       - `evolucaoMensal`: Receita x Despesa x Lucro, ultimos 12 meses;
 *       - `despesasPorCategoria`: soma por tipo (fixa/variavel/comissao/outro),
 *         sempre com as 4 categorias (zeros preenchidos);
 *       - `receitaRealizadaPrevista`: receita concluida (realizada) vs.
 *         pendente/confirmado (prevista), por semana de calendario.
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
 *         description: Resumo financeiro completo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ResumoFinanceiro' }
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 */

// Negação por padrão: qualquer usuário autenticado, mas apenas quem tem a
// permissão efetiva `ver_financeiro` chega ao handler (403 caso contrário).
financeiroRoutes.get('/resumo', authenticate, requerPermissao('ver_financeiro'), resumoFinanceiroHandler);

export default financeiroRoutes;