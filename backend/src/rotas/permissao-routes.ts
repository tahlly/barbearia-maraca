import { Router } from 'express';
import { authorize } from '../middlewares/authorize';
import { requerPermissao } from '../middlewares/requerPermissao';
import {
  atualizarPermissaoHandler,
  listarCatalogo,
  listarUsuarios,
} from '../controllers/permissao-controller';

const permissaoRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Permissao:
 *       type: object
 *       properties:
 *         chave: { type: string, example: editar_servicos_categorias }
 *         descricao: { type: string }
 *     UsuarioPermissoes:
 *       type: object
 *       properties:
 *         usuarioId: { type: string }
 *         email: { type: string }
 *         nome: { type: string }
 *         cargo: { type: string, example: recepcionista }
 *         permissoes:
 *           type: object
 *           additionalProperties: { type: boolean }
 *           example:
 *             ver_financeiro: false
 *             excluir_desativar_funcionario: true
 *             criar_admin: false
 *             gerenciar_permissoes: false
 *             editar_servicos_categorias: true
 *     AtualizarPermissaoRequest:
 *       type: object
 *       required: [permissao, concedida]
 *       properties:
 *         permissao: { type: string, example: editar_servicos_categorias }
 *         concedida: { type: boolean }
 *
 * /api/permissoes:
 *   get:
 *     tags: [Permissoes]
 *     summary: Lista o catalogo de permissoes (requer gerenciar_permissoes)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Catalogo de permissoes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Permissao' }
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/permissoes/usuarios:
 *   get:
 *     tags: [Permissoes]
 *     summary: Lista funcionarios com permissoes efetivas (requer gerenciar_permissoes)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Usuarios com permissoes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/UsuarioPermissoes' }
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *
 * /api/permissoes/usuarios/{id}:
 *   put:
 *     tags: [Permissoes]
 *     summary: Concede ou revoga uma permissao (requer gerenciar_permissoes)
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
 *           schema: { $ref: '#/components/schemas/AtualizarPermissaoRequest' }
 *     responses:
 *       '200':
 *         description: Permissao atualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '403':
 *         $ref: '#/components/responses/Erro403'
 *       '404':
 *         $ref: '#/components/responses/Erro404'
 */

// Gestão de permissões exige autenticação e a permissão granular
// `gerenciar_permissoes` (admin a tem por padrão; quem receber concessão
// explícita também pode gerir).
permissaoRoutes.get(
  '/',
  authorize('admin', 'recepcionista'),
  requerPermissao('gerenciar_permissoes'),
  listarCatalogo
);
permissaoRoutes.get(
  '/usuarios',
  authorize('admin', 'recepcionista'),
  requerPermissao('gerenciar_permissoes'),
  listarUsuarios
);
permissaoRoutes.put(
  '/usuarios/:id',
  authorize('admin', 'recepcionista'),
  requerPermissao('gerenciar_permissoes'),
  atualizarPermissaoHandler
);

export default permissaoRoutes;