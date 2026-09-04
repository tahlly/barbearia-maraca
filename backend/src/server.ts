import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import db from './database/connection';
import servicoRoutes from './rotas/servico-routes';
import authRoutes from './rotas/auth-routes';
import { errorHandler } from './middlewares/errorHandler';
import { NotFoundError } from './errors/NotFoundError';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json());

const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/api/health', async (req: Request, res: Response) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

app.get('/api/servicos', async (req: Request, res: Response) => {
  try {
    const servicos = await db('servico').where('ativo', true).select('*');
    res.json(servicos);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar servicos' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/servicos', servicoRoutes);

app.use('/api/{*path}', (_req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError('Rota não encontrada'));
});

app.get('/{*path}', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
