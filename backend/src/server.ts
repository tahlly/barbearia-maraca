import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import db from './database/connection';
import servicoRoutes from './rotas/servico-routes';

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

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ message: 'Email e senha obrigatorios' });
  }

  try {
    const bcrypt = await import('bcrypt');
    const usuario = await db('usuario').where('email', email).first();

    if (!usuario) {
      return res.status(401).json({ message: 'Credenciais invalidas' });
    }

    const senhaValida = await bcrypt.default.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ message: 'Credenciais invalidas' });
    }

    const funcionario = await db('funcionario').where('usuario_id', usuario.id).first();
    const cliente = await db('cliente').where('usuario_id', usuario.id).first();

    const userData = {
      id: usuario.id,
      email: usuario.email,
      tipo: usuario.tipo,
      nome: funcionario?.nome || cliente?.nome,
      cargo: funcionario?.cargo || null,
    };

    res.json({ token: 'token_placeholder', user: userData });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao autenticar' });
  }
});

app.use('/servicos', servicoRoutes);

app.get('/{*path}', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
