import fastify from 'fastify';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/routes/auth.routes.js';
import { isAppError, AppError } from './shared/errors/AppError.js';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';

export async function buildApp() {
  const app = fastify({
    logger: env.NODE_ENV === 'development',
    ajv: { customOptions: { removeAdditional: 'all' } },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(cookie, {
    secret: env.JWT_SECRET,
    hook: 'onRequest',
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (isAppError(error)) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        ...(error instanceof AppError && 'details' in error && { details: (error as any).details }),
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor',
    });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/api' });

  return app;
}