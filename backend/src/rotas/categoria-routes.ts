import { Router } from 'express';
import { listarCategorias } from '../controllers/categoria-controller';

const categoriaRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Categoria:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         nome: { type: string, example: Cabelo }
 *
 * /api/categorias:
 *   get:
 *     tags: [Categorias]
 *     summary: Lista categorias ativas (publico)
 *     responses:
 *       '200':
 *         description: Lista de categorias
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Categoria' }
 */

// Público (sem autenticação) — categorias ativas para o catálogo.
categoriaRoutes.get('/', listarCategorias);

export default categoriaRoutes;