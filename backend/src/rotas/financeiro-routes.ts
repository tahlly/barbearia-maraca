import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { requerPermissao } from '../middlewares/requerPermissao';
import { resumoFinanceiroHandler } from '../controllers/resumo-financeiro-controller';
import {
  obterConfiguracaoHandler,
  atualizarConfiguracaoHandler,
  listarComissoesHandler,
  salvarComissoesHandler,
} from '../controllers/comissao-controller';

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
 *     ConfiguracaoComissao:
 *       type: object
 *       required: [comissao_ativa]
 *       properties:
 *         comissao_ativa:
 *           type: boolean
 *           example: true
 *           description: Interruptor global de comissao (spec 3.4).
 *     RequestAtualizarConfiguracaoComissao:
 *       type: object
 *       required: [comissao_ativa]
 *       properties:
 *         comissao_ativa: { type: boolean }
 *     ComissaoServico:
 *       type: object
 *       required: [servico_id, servico_nome, percentual]
 *       properties:
 *         servico_id: { type: string, format: uuid }
 *         servico_nome: { type: string, example: 'Corte' }
 *         percentual:
 *           type: string
 *           example: '40.00'
 *           description: Percentual 0..100 (string decimal normalizada).
 *     ItemComissaoServicoRequest:
 *       type: object
 *       required: [servico_id, percentual]
 *       properties:
 *         servico_id: { type: string, format: uuid }
 *         percentual: { type: number, minimum: 0, maximum: 100, example: 40 }
 *     RequestSalvarComissoesFuncionario:
 *       type: object
 *       required: [comissoes]
 *       properties:
 *         comissoes:
 *           type: array
 *           items: { $ref: '#/components/schemas/ItemComissaoServicoRequest' }
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
 *
 * /api/financeiro/comissao/configuracao:
 *   get:
 *     tags: [Financeiro]
 *     summary: Interruptor global de comissao (spec 3.4; requer ver_financeiro).
 *     description: >
 *       Acesso restrito a quem possui a permissao efetiva `ver_financeiro`.
 *
 *       Retorna `{ comissao_ativa }`. Quando a linha singleton ainda nao
 *       existe, devolve `false` — nao inventa linha no banco.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Estado do interruptor
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ConfiguracaoComissao' }
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *   put:
 *     tags: [Financeiro]
 *     summary: Liga/desliga a comissao global (upsert; requer ver_financeiro).
 *     description: >
 *       Acesso restrito a `ver_financeiro`.
 *
 *       Upsert na linha singleton `id='global'`. Desligar NUNCA apaga as
 *       linhas de `comissao_servico` — elas sao mantidas e param de ser
 *       aplicadas (spec 3.4).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RequestAtualizarConfiguracaoComissao' }
 *     responses:
 *       '200':
 *         description: Estado salvo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ConfiguracaoComissao' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/financeiro/comissao/funcionarios/{funcionarioId}:
 *   get:
 *     tags: [Financeiro]
 *     summary: Comissoes por servico de um funcionario (spec 3.5; requer ver_financeiro).
 *     description: >
 *       Acesso restrito a `ver_financeiro`. Lista as linhas de `comissao_servico`
 *       do funcionario (com nome do servico), ordenadas por nome do servico.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: funcionarioId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Lista de comissoes do funcionario
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ComissaoServico' }
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '404':
 *         $ref: '#/components/responses/Erro404'
 *   put:
 *     tags: [Financeiro]
 *     summary: Salva as comissoes de um funcionario (REPLACE; requer ver_financeiro).
 *     description: >
 *       Acesso restrito a `ver_financeiro`.
 *
 *       Substitui TODAS as linhas de `comissao_servico` do funcionario pelas
 *       informadas (lista vazia limpa as linhas). A operacao e atomica
 *       (transacao): delete + insert. Valida servicos (existentes e ativos),
 *       percentuais (numericos 0..100, max. 2 casas) e rejeita servico
 *       duplicado na lista.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: funcionarioId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RequestSalvarComissoesFuncionario' }
 *     responses:
 *       '200':
 *         description: Lista salva (com nome do servico)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ComissaoServico' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '404':
 *         $ref: '#/components/responses/Erro404'
 */

// Negação por padrão: qualquer usuário autenticado, mas apenas quem tem a
// permissão efetiva `ver_financeiro` chega ao handler (403 caso contrário).
financeiroRoutes.get('/resumo', authenticate, requerPermissao('ver_financeiro'), resumoFinanceiroHandler);

// ── Regras de Comissão (spec 3.4/3.5) ─────────────────────────────────
// Mesma proteção do módulo financeiro: somente `ver_financeiro`.
financeiroRoutes.get(
  '/comissao/configuracao',
  authenticate,
  requerPermissao('ver_financeiro'),
  obterConfiguracaoHandler,
);
financeiroRoutes.put(
  '/comissao/configuracao',
  authenticate,
  requerPermissao('ver_financeiro'),
  atualizarConfiguracaoHandler,
);
financeiroRoutes.get(
  '/comissao/funcionarios/:funcionarioId',
  authenticate,
  requerPermissao('ver_financeiro'),
  listarComissoesHandler,
);
financeiroRoutes.put(
  '/comissao/funcionarios/:funcionarioId',
  authenticate,
  requerPermissao('ver_financeiro'),
  salvarComissoesHandler,
);

export default financeiroRoutes;