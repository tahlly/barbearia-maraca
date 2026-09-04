import './config/env';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
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
