import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import {
  listarClientesHandler,
  obterClienteHandler,
  criarClienteHandler,
  atualizarClienteHandler,
} from '../controllers/cliente-controller';

const clienteRoutes = Router();

// Listar todos: apenas recepcionista/admin.
clienteRoutes.get('/', authorize('recepcionista', 'admin'), listarClientesHandler);

// Detalhe: recepcionista/admin ou o próprio cliente autenticado (ownership na service).
clienteRoutes.get('/:id', authenticate, obterClienteHandler);

// Criar: apenas recepcionista/admin.
clienteRoutes.post('/', authorize('recepcionista', 'admin'), criarClienteHandler);

// Atualizar: recepcionista/admin ou o próprio cliente autenticado (ownership na service).
clienteRoutes.put('/:id', authenticate, atualizarClienteHandler);

export default clienteRoutes;
