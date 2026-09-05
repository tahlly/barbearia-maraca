/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Erro:
 *       type: object
 *       required: [erro, mensagem, status]
 *       properties:
 *         erro: { type: boolean, example: true }
 *         mensagem: { type: string }
 *         status: { type: number }
 *         detalhes:
 *           type: array
 *           items: { type: string }
 *   responses:
 *     Erro400:
 *       description: Requisicao invalida
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Erro' }
 *     Erro401:
 *       description: Nao autenticado
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Erro' }
 *     Erro403:
 *       description: Acesso negado
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Erro' }
 *     Erro404:
 *       description: Nao encontrado
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Erro' }
 *     Erro500:
 *       description: Erro interno
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Erro' }
 *
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Verifica a saude do servidor e do banco
 *     responses:
 *       '200':
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 database: { type: string, example: connected }
 *       '500':
 *         $ref: '#/components/responses/Erro500'
 */

import './config/env';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middlewares/errorHandler';
import { NotFoundError } from './errors/NotFoundError';
import authRoutes from './rotas/auth-routes';
import servicoRoutes from './rotas/servico-routes';
import clienteRoutes from './rotas/cliente-routes';
import funcionarioRoutes from './rotas/funcionario-routes';
import agendamentoRoutes from './rotas/agendamento-routes';
import horarioRoutes from './rotas/horario-routes';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const frontendPath = path.resolve(__dirname, '..', '..', 'frontend', 'dist');

// ── Middlewares globais ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Arquivos estáticos do frontend ──────────────────────────────────
app.use(express.static(frontendPath));

// ── Health check ────────────────────────────────────────────────────
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const db = (await import('./database/connection')).default;
    await db.raw('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// ── Swagger UI (documentação da API) ────────────────────────────────
// Lê o spec OpenAPI gerado por `npm run swagger` (backend/openapi.json).
// Se o arquivo ainda não existir, expõe a UI com uma mensagem orientativa.
const openapiPath = path.join(__dirname, '..', 'openapi.json');
let swaggerDocument: object;
try {
  swaggerDocument = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
} catch {
  swaggerDocument = {
    openapi: '3.0.0',
    info: {
      title: 'Barbearia Maraca API',
      version: '1.0.0',
      description:
        'Spec nao encontrado. Rode `npm run swagger` no diretorio backend/ para gerar o openapi.json.',
    },
    paths: {},
  };
}
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ── Routers (todos sob /api) ────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/servicos', servicoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/funcionarios', funcionarioRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/horarios', horarioRoutes);

// ── 404 para rotas /api não mapeadas ────────────────────────────────
app.use('/api/{*path}', (_req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError('Rota não encontrada'));
});

// ── SPA fallback ────────────────────────────────────────────────────
app.get('/{*path}', (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ── Handler centralizado de erros (deve ser o último middleware) ─────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
