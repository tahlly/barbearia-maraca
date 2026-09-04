import { Router } from 'express';
import { authorize } from '../middlewares/authorize';
import { authenticate } from '../middlewares/authenticate';
import {
  listarPublicos,
  listarDetalhes,
  buscarPorId,
  buscarPorEmail,
  criar,
  atualizar,
  alterarStatus,
} from '../controllers/funcionario-controller';

const funcionarioRoutes = Router();

// GET / — público (sem autenticação)
funcionarioRoutes.get('/', listarPublicos);

// GET /detalhes — autenticado; admin ou recepcionista
funcionarioRoutes.get('/detalhes', authenticate, authorize('recepcionista', 'admin'), listarDetalhes);

// GET /buscar?email=... — autenticado; permissão verificada no service
// (admin/recepcionista qualquer funcionário; profissional só o próprio).
// Registrada antes de '/:id' para não ser capturada como parâmetro de caminho.
funcionarioRoutes.get('/buscar', authenticate, buscarPorEmail);

// GET /:id — protegido (autenticado; permissão verificada no service/controller)
funcionarioRoutes.get('/:id', authenticate, buscarPorId);

// POST — recepcionista ou admin
funcionarioRoutes.post('/', authorize('recepcionista', 'admin'), criar);

// PUT — recepcionista ou admin
funcionarioRoutes.put('/:id', authorize('recepcionista', 'admin'), atualizar);

// PATCH /:id/status — recepcionista ou admin
funcionarioRoutes.patch('/:id/status', authorize('recepcionista', 'admin'), alterarStatus);

export default funcionarioRoutes;
