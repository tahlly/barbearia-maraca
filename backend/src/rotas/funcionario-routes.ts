import { Router } from 'express';
import { authorize } from '../middlewares/authorize';
import { authenticate } from '../middlewares/authenticate';
import {
  listarPublicos,
  listarDetalhes,
  buscarPorId,
  buscarPorEmail,
  criar,
  atualizar,
  alterarStatus,
} from '../controllers/funcionario-controller';

const funcionarioRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     FuncionarioPublico:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         nome: { type: string }
 *         especialidade: { type: string, nullable: true }
 *         foto: { type: string, nullable: true }
 *         descricao: { type: string, nullable: true }
 *     Funcionario:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         usuarioId: { type: string }
 *         nome: { type: string }
 *         telefone: { type: string, nullable: true }
 *         cargo:
 *           type: string
 *           enum: [barbeiro, recepcionista, administrador]
 *         especialidade: { type: string, nullable: true }
 *         foto: { type: string, nullable: true }
 *         descricao: { type: string, nullable: true }
 *         ativo: { type: boolean }
 *         email: { type: string }
 *         createdAt: { type: string }
 *         updatedAt: { type: string }
 *     CreateFuncionarioRequest:
 *       type: object
 *       required: [nome, email, senha]
 *       properties:
 *         nome: { type: string }
 *         email: { type: string, format: email }
 *         senha: { type: string, format: password, minLength: 6 }
 *         telefone: { type: string }
 *         cargo:
 *           type: string
 *           enum: [barbeiro, recepcionista, administrador]
 *         especialidade: { type: string }
 *     UpdateFuncionarioRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         nome: { type: string }
 *         email: { type: string, format: email }
 *         senha: { type: string, format: password, minLength: 6 }
 *         telefone: { type: string }
 *         cargo:
 *           type: string
 *           enum: [barbeiro, recepcionista, administrador]
 *         especialidade: { type: string }
 *         foto: { type: string }
 *         descricao: { type: string }
 *     UpdateFuncionarioStatusRequest:
 *       type: object
 *       required: [ativo]
 *       properties:
 *         ativo: { type: boolean }
 *     StatusResponse:
 *       type: object
 *       properties:
 *         mensagem: { type: string }
 *         ativo: { type: boolean }
 *
 * /api/funcionarios:
 *   get:
 *     tags: [Funcionarios]
 *     summary: Lista funcionarios ativos (publico)
 *     parameters:
 *       - in: query
 *         name: cargo
 *         required: false
 *         schema:
 *           type: string
 *           enum: [barbeiro, recepcionista, administrador]
 *     responses:
 *       '200':
 *         description: Lista de funcionarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/FuncionarioPublico' }
 *   post:
 *     tags: [Funcionarios]
 *     summary: Cria um funcionario (recepcionista/admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateFuncionarioRequest' }
 *     responses:
 *       '201':
 *         description: Funcionario criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Funcionario' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/funcionarios/detalhes:
 *   get:
 *     tags: [Funcionarios]
 *     summary: Lista funcionarios com dados completos (recepcionista/admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista completa de funcionarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Funcionario' }
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/funcionarios/buscar:
 *   get:
 *     tags: [Funcionarios]
 *     summary: Busca funcionario por email
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema: { type: string, format: email }
 *     responses:
 *       '200':
 *         description: Funcionario encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Funcionario' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *
 * /api/funcionarios/{id}:
 *   get:
 *     tags: [Funcionarios]
 *     summary: Obtem um funcionario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Funcionario encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Funcionario' }
 *       '404':
 *         $ref: '#/components/responses/Erro404'
 *   put:
 *     tags: [Funcionarios]
 *     summary: Atualiza um funcionario (recepcionista/admin)
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
 *           schema: { $ref: '#/components/schemas/UpdateFuncionarioRequest' }
 *     responses:
 *       '200':
 *         description: Funcionario atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Funcionario' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/funcionarios/{id}/status:
 *   patch:
 *     tags: [Funcionarios]
 *     summary: Alterna status ativo/inativo de um funcionario (recepcionista/admin)
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
 *           schema: { $ref: '#/components/schemas/UpdateFuncionarioStatusRequest' }
 *     responses:
 *       '200':
 *         description: Status atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/StatusResponse' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 */

// GET / — público (sem autenticação)
funcionarioRoutes.get('/', listarPublicos);

// GET /detalhes — autenticado; admin ou recepcionista
funcionarioRoutes.get('/detalhes', authenticate, authorize('recepcionista', 'admin'), listarDetalhes);

// GET /buscar?email=... — autenticado; permissão verificada no service
// (admin/recepcionista qualquer funcionário; profissional só o próprio).
// Registrada antes de '/:id' para não ser capturada como parâmetro de caminho.
funcionarioRoutes.get('/buscar', authenticate, buscarPorEmail);

// GET /:id — protegido (autenticado; permissão verificada no service/controller)
funcionarioRoutes.get('/:id', authenticate, buscarPorId);

// POST — recepcionista ou admin
funcionarioRoutes.post('/', authorize('recepcionista', 'admin'), criar);

// PUT — recepcionista ou admin
funcionarioRoutes.put('/:id', authorize('recepcionista', 'admin'), atualizar);

// PATCH /:id/status — recepcionista ou admin
funcionarioRoutes.patch('/:id/status', authorize('recepcionista', 'admin'), alterarStatus);

export default funcionarioRoutes;
