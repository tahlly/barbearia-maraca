import { Router } from 'express';
import { authorize } from '../middlewares/authorize';
import {
  listarServicos,
  obterServico,
  criarServico,
  atualizarServico,
  atualizarStatusServico,
} from '../controllers/servico-controller';

const servicoRoutes = Router();

// Público (sem autenticação) — apenas serviços ativos (S1-11.3)
servicoRoutes.get('/', listarServicos);

// Protegido: somente administrador (S1-11.1, S1-11.2)
servicoRoutes.get('/:id', authorize('admin'), obterServico);
servicoRoutes.post('/', authorize('admin'), criarServico);
servicoRoutes.put('/:id', authorize('admin'), atualizarServico);
servicoRoutes.patch('/:id/status', authorize('admin'), atualizarStatusServico);

export default servicoRoutes;
