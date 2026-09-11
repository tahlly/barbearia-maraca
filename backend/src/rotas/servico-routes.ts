import { Router } from 'express';
import { authorize } from '../middlewares/authorize';
import { requerPermissao } from '../middlewares/requerPermissao';
import {
  listarServicos,
  obterServico,
  criarServico,
  atualizarServico,
  atualizarStatusServico,
} from '../controllers/servico-controller';

const servicoRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     ServicoPublico:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         nome: { type: string }
 *         descricao: { type: string, nullable: true }
 *         duracao_minutos: { type: integer, example: 30 }
 *         preco: { type: string, example: '50.00' }
 *         categorias:
 *           type: array
 *           items: { type: string }
 *           example: [Cabelo, Barba]
 *     Servico:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         nome: { type: string }
 *         descricao: { type: string, nullable: true }
 *         duracao_minutos: { type: integer, example: 30 }
 *         preco: { type: string, example: '50.00' }
 *         ativo: { type: boolean }
 *         categorias:
 *           type: array
 *           items: { type: string }
 *           example: [Cabelo, Barba]
 *     CreateServicoRequest:
 *       type: object
 *       required: [nome, duracao_minutos, preco]
 *       properties:
 *         nome: { type: string }
 *         descricao: { type: string, nullable: true }
 *         duracao_minutos: { type: integer, example: 30 }
 *         preco:
 *           oneOf:
 *             - { type: number, example: 50 }
 *             - { type: string, example: '50.00' }
 *     UpdateServicoRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         nome: { type: string }
 *         descricao: { type: string, nullable: true }
 *         duracao_minutos: { type: integer, example: 30 }
 *         preco:
 *           oneOf:
 *             - { type: number }
 *             - { type: string }
 *     UpdateServicoStatusRequest:
 *       type: object
 *       required: [ativo]
 *       properties:
 *         ativo: { type: boolean }
 *
 * /api/servicos:
 *   get:
 *     tags: [Servicos]
 *     summary: Lista servicos ativos (publico)
 *     responses:
 *       '200':
 *         description: Lista de servicos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ServicoPublico' }
 *   post:
 *     tags: [Servicos]
 *     summary: Cria um servico (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateServicoRequest' }
 *     responses:
 *       '201':
 *         description: Servico criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Servico' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/servicos/{id}:
 *   get:
 *     tags: [Servicos]
 *     summary: Obtem um servico (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Servico encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Servico' }
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '404':
 *         $ref: '#/components/responses/Erro404'
 *   put:
 *     tags: [Servicos]
 *     summary: Atualiza um servico (admin)
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
 *           schema: { $ref: '#/components/schemas/UpdateServicoRequest' }
 *     responses:
 *       '200':
 *         description: Servico atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Servico' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/servicos/{id}/status:
 *   patch:
 *     tags: [Servicos]
 *     summary: Alterna status ativo/inativo de um servico (admin)
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
 *           schema: { $ref: '#/components/schemas/UpdateServicoStatusRequest' }
 *     responses:
 *       '200':
 *         description: Status atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Servico' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 */

// Público (sem autenticação) — apenas serviços ativos (S1-11.3)
servicoRoutes.get('/', listarServicos);

// Protegido: admin ou recepcionista com permissão granular
// `editar_servicos_categorias` (Item 1 — decisão A aprovada: recepcionista
// também edita serviços).
servicoRoutes.get('/:id', authorize('admin', 'recepcionista'), requerPermissao('editar_servicos_categorias'), obterServico);
servicoRoutes.post('/', authorize('admin', 'recepcionista'), requerPermissao('editar_servicos_categorias'), criarServico);
servicoRoutes.put('/:id', authorize('admin', 'recepcionista'), requerPermissao('editar_servicos_categorias'), atualizarServico);
servicoRoutes.patch('/:id/status', authorize('admin', 'recepcionista'), requerPermissao('editar_servicos_categorias'), atualizarStatusServico);

export default servicoRoutes;
