import { Router } from 'express';
import {
  loginComGoogle,
  registrarUsuario,
  loginLocal,
  logout,
  atualizarPerfilHandler,
} from '../controllers/auth-controller';
import { authenticate } from '../middlewares/authenticate';

const authRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         email: { type: string }
 *         tipo: { type: string }
 *         nome: { type: string, nullable: true }
 *         cargo: { type: string, nullable: true }
 *         avatarUrl: { type: string, nullable: true }
 *     AuthLoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email: { type: string, example: cliente@email.com }
 *         password: { type: string, example: senha123 }
 *     AuthLoginResponse:
 *       type: object
 *       properties:
 *         token: { type: string }
 *         userName: { type: string, nullable: true }
 *         userEmail: { type: string }
 *         expiresAt: { type: number }
 *         role:
 *           type: string
 *           enum: [admin, recepcionista, profissional, cliente]
 *         user:
 *           $ref: '#/components/schemas/Usuario'
 *     AuthRegisterRequest:
 *       type: object
 *       required: [email, senha, nome]
 *       properties:
 *         email: { type: string, example: novo@email.com }
 *         senha: { type: string, format: password, minLength: 6 }
 *         nome: { type: string }
 *         telefone: { type: string, nullable: true }
 *     AuthRegisterResponse:
 *       type: object
 *       properties:
 *         token: { type: string }
 *         user:
 *           type: object
 *           properties:
 *             id: { type: string }
 *             email: { type: string }
 *             nome: { type: string, nullable: true }
 *             tipo: { type: string }
 *     GoogleLoginRequest:
 *       type: object
 *       required: [idToken]
 *       properties:
 *         idToken: { type: string }
 *     GoogleLoginResponse:
 *       type: object
 *       properties:
 *         token: { type: string }
 *         userName: { type: string, nullable: true }
 *         userEmail: { type: string }
 *         expiresAt: { type: number }
 *         role:
 *           type: string
 *           enum: [admin, recepcionista, profissional, cliente]
 *         avatarUrl: { type: string, nullable: true }
 *     AtualizarPerfilRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         nome: { type: string }
 *         email: { type: string, format: email }
 *         senha: { type: string, format: password, minLength: 6 }
 *     AuthLogoutResponse:
 *       type: object
 *       properties:
 *         mensagem: { type: string, example: Logout realizado }
 *
 * /api/auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Login com conta Google
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/GoogleLoginRequest' }
 *     responses:
 *       '200':
 *         description: Login realizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/GoogleLoginResponse' }
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar novo usuario (cliente)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AuthRegisterRequest' }
 *     responses:
 *       '201':
 *         description: Conta criada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthRegisterResponse' }
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login local (email e senha)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AuthLoginRequest' }
 *     responses:
 *       '200':
 *         description: Login realizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthLoginResponse' }
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 *
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Realizar logout
 *     responses:
 *       '200':
 *         description: Logout realizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthLogoutResponse' }
 *
 * /api/auth/me:
 *   patch:
 *     tags: [Auth]
 *     summary: Atualizar perfil do usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AtualizarPerfilRequest' }
 *     responses:
 *       '200':
 *         description: Perfil atualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 user:
 *                   $ref: '#/components/schemas/Usuario'
 *       '400':
 *         $ref: '#/components/responses/Erro400'
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 */

authRoutes.post('/google', loginComGoogle);
authRoutes.post('/register', registrarUsuario);
authRoutes.post('/login', loginLocal);
authRoutes.post('/logout', logout);
authRoutes.patch('/me', authenticate, atualizarPerfilHandler);

export default authRoutes;
