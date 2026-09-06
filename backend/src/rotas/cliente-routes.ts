import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import {
  listarClientesHandler,
  obterClienteHandler,
  buscarClientePorEmailHandler,
  criarClienteHandler,
  atualizarClienteHandler,
} from '../controllers/cliente-controller';

const clienteRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Cliente:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         nome: { type: string }
 *         email: { type: string }
 *         telefone: { type: string, nullable: true }
 *     CreateClienteRequest:
 *       type: object
 *       required: [nome, email, senha]
 *       properties:
 *         nome: { type: string }
 *         email: { type: string, format: email }
 *         telefone: { type: string }
 *         senha: { type: string, format: password, minLength: 6 }
 *     UpdateClienteRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         nome: { type: string }
 *         email: { type: string, format: email }
 *         telefone: { type: string }
 *
 * /api/clientes:
 *   get:
 *     tags: [Clientes]
 *     summary: Lista todos os clientes (recepcionista/admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: busca
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Lista de clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Cliente' }
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *   post:
 *     tags: [Clientes]
 *     summary: Cria um cliente (recepcionista/admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateClienteRequest' }
 *     responses:
 *       '201':
 *         description: Cliente criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Cliente' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/clientes/buscar:
 *   get:
 *     tags: [Clientes]
 *     summary: Busca cliente por email
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema: { type: string, format: email }
 *     responses:
 *       '200':
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Cliente' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *
 * /api/clientes/{id}:
 *   get:
 *     tags: [Clientes]
 *     summary: Obtem um cliente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Cliente' }
 *       '404':
 *         $ref: '#/components/responses/Erro404'
 *   put:
 *     tags: [Clientes]
 *     summary: Atualiza um cliente
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
 *           schema: { $ref: '#/components/schemas/UpdateClienteRequest' }
 *     responses:
 *       '200':
 *         description: Cliente atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Cliente' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 */

// Listar todos: apenas recepcionista/admin.
clienteRoutes.get('/', authorize('recepcionista', 'admin'), listarClientesHandler);

// Buscar por e-mail: recepcionista/admin ou o próprio cliente autenticado
// (ownership na service). Registrada antes de '/:id' para não ser capturada
// como parâmetro de caminho.
clienteRoutes.get('/buscar', authenticate, buscarClientePorEmailHandler);

// Detalhe: recepcionista/admin ou o próprio cliente autenticado (ownership na service).
clienteRoutes.get('/:id', authenticate, obterClienteHandler);

// Criar: apenas recepcionista/admin.
clienteRoutes.post('/', authorize('recepcionista', 'admin'), criarClienteHandler);

// Atualizar: recepcionista/admin ou o próprio cliente autenticado (ownership na service).
clienteRoutes.put('/:id', authenticate, atualizarClienteHandler);

export default clienteRoutes;
