import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { requerPermissao } from '../middlewares/requerPermissao';
import {
  resumoHandler,
  listarDespesasHandler,
  criarDespesaHandler,
  atualizarDespesaHandler,
  excluirDespesaHandler,
} from '../controllers/despesa-controller';

const despesaRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Despesa:
 *       type: object
 *       required: [id, descricao, tipo_despesa, valor, data, recorrente, funcionario_id, automatica]
 *       properties:
 *         id: { type: string, format: uuid }
 *         descricao: { type: string, example: 'Aluguel' }
 *         tipo_despesa: { type: string, enum: [fixa, variavel, comissao, outro] }
 *         valor: { type: string, example: '45.90' }
 *         data: { type: string, format: date }
 *         recorrente: { type: boolean, example: true }
 *         funcionario_id: { type: string, format: uuid, nullable: true }
 *         automatica:
 *           type: boolean
 *           example: false
 *           description: true quando a despesa foi gerada pelo hook de comissao (agendamento_id preenchido); despesas manuais sao sempre false.
 *     DespesaResumo:
 *       type: object
 *       required: [inicio, fim, despesaTotal]
 *       properties:
 *         inicio: { type: string, format: date }
 *         fim: { type: string, format: date }
 *         despesaTotal: { type: string, example: '57.50' }
 *     CreateDespesaRequest:
 *       type: object
 *       required: [descricao, tipo_despesa, valor, data, recorrente]
 *       properties:
 *         descricao: { type: string, example: 'Aluguel' }
 *         tipo_despesa:
 *           type: string
 *           enum: [fixa, variavel, outro]
 *           description: 'NUNCA comissao: despesas de comissao sao geradas automaticamente pelo sistema (ver descricao do endpoint).'
 *         valor:
 *           oneOf:
 *             - { type: number, example: 45.9 }
 *             - { type: string, example: '45.90' }
 *         data: { type: string, format: date }
 *         recorrente: { type: boolean, example: false }
 *         funcionario_id: { type: string, format: uuid, nullable: true }
 *     UpdateDespesaRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         descricao: { type: string }
 *         tipo_despesa:
 *           type: string
 *           enum: [fixa, variavel, outro]
 *           description: 'NUNCA comissao (ver descricao do endpoint).'
 *         valor:
 *           oneOf:
 *             - { type: number }
 *             - { type: string }
 *         data: { type: string, format: date }
 *         recorrente: { type: boolean }
 *         funcionario_id: { type: string, format: uuid, nullable: true }
 *
 * /api/despesas:
 *   get:
 *     tags: [Despesas]
 *     summary: Lista despesas do periodo (requer permissao ver_financeiro).
 *     description: >
 *       Acesso restrito a quem possui a permissao efetiva `ver_financeiro`
 *       (admin por padrao; overrides no banco contam). Recepcionista sem a
 *       permissao recebe 403.
 *
 *       Retorna a tabela da tela Financeiro › Despesas, ordenada por data
 *       (mais recentes primeiro). Filtros opcionais:
 *       - `inicio`/`fim` devem vir JUNTOS (intervalo de datas);
 *       - `tipo_despesa` filtra por categoria.
 *
 *       Despesas com `automatica: true` (comissao gerada pelo hook) aparecem
 *       na listagem para leitura, mas nao podem ser editadas/excluídas aqui.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: inicio
 *         required: false
 *         schema: { type: string, format: date }
 *         description: Data inicial do periodo (YYYY-MM-DD); exige fim junto.
 *       - in: query
 *         name: fim
 *         required: false
 *         schema: { type: string, format: date }
 *         description: Data final do periodo (YYYY-MM-DD); exige inicio junto.
 *       - in: query
 *         name: tipo_despesa
 *         required: false
 *         schema: { type: string, enum: [fixa, variavel, comissao, outro] }
 *     responses:
 *       '200':
 *         description: Lista de despesas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Despesa' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *   post:
 *     tags: [Despesas]
 *     summary: Cria uma despesa MANUAL (requer permissao ver_financeiro).
 *     description: >
 *       Acesso restrito a `ver_financeiro`.
 *
 *       REGRA DE PROTECAO: `tipo_despesa` NAO pode ser `comissao`. Despesas
 *       de comissao sao geradas EXCLUSIVAMENTE pelo hook automatico de Regras
 *       de Comissao (que preenche `agendamento_id` e marca `automatica`).
 *       Tentativa de criar comissão manual → 400 com mensagem explicativa.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateDespesaRequest' }
 *     responses:
 *       '201':
 *         description: Despesa criada (automatica sempre false)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Despesa' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/despesas/{id}:
 *   put:
 *     tags: [Despesas]
 *     summary: Edita uma despesa MANUAL existente (requer permissao ver_financeiro).
 *     description: >
 *       Acesso restrito a `ver_financeiro`.
 *
 *       REGRA DE PROTECAO: NAO permite editar despesa ja marcada como
 *       `comissao` (automatica) nem mudar o tipo para `comissao` → 400.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateDespesaRequest' }
 *     responses:
 *       '200':
 *         description: Despesa atualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Despesa' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '404':
 *         $ref: '#/components/responses/Erro404'
 *   delete:
 *     tags: [Despesas]
 *     summary: Exclui uma despesa MANUAL (requer permissao ver_financeiro).
 *     description: >
 *       Acesso restrito a `ver_financeiro`.
 *
 *       REGRA DE PROTECAO: NAO permite excluir despesa de `comissao`
 *       (automatica) — essas so podem ser removidas pelo fluxo que as gerou
 *       (Regras de Comissao). → 400.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204':
 *         description: Despesa excluída
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '404':
 *         $ref: '#/components/responses/Erro404'
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
// permissão efetiva `ver_financeiro` chega ao handler (403 caso contrário).
despesaRoutes.get('/resumo', authenticate, requerPermissao('ver_financeiro'), resumoHandler);
despesaRoutes.get('/', authenticate, requerPermissao('ver_financeiro'), listarDespesasHandler);
despesaRoutes.post('/', authenticate, requerPermissao('ver_financeiro'), criarDespesaHandler);
despesaRoutes.put('/:id', authenticate, requerPermissao('ver_financeiro'), atualizarDespesaHandler);
despesaRoutes.delete('/:id', authenticate, requerPermissao('ver_financeiro'), excluirDespesaHandler);

export default despesaRoutes;
