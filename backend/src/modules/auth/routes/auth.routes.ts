import { FastifyInstance } from 'fastify';
import { authController } from '../controllers/auth.controller.js';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/cadastro', authController.cadastro);
  app.post('/auth/login', authController.login);
  app.post('/auth/refresh', authController.refreshToken);
  app.post('/auth/logout', authController.logout);

  app.get('/auth/me', { preHandler: authMiddleware }, authController.me);

  app.post('/auth/cadastro/admin', { preHandler: requireRole('ADMINISTRADOR') }, authController.cadastro);
}