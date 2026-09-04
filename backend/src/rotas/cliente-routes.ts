import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import {
  listarClientesHandler,
  obterClienteHandler,
  buscarClientePorEmailHandler,
  criarClienteHandler,
  atualizarClienteHandler,
} from '../controllers/cliente-controller';

const clienteRoutes = Router();

// Listar todos: apenas recepcionista/admin.
clienteRoutes.get('/', authorize('recepcionista', 'admin'), listarClientesHandler);

// Buscar por e-mail: recepcionista/admin ou o próprio cliente autenticado
// (ownership na service). Registrada antes de '/:id' para não ser capturada
// como parâmetro de caminho.
clienteRoutes.get('/buscar', authenticate, buscarClientePorEmailHandler);

// Detalhe: recepcionista/admin ou o próprio cliente autenticado (ownership na service).
clienteRoutes.get('/:id', authenticate, obterClienteHandler);

// Criar: apenas recepcionista/admin.
clienteRoutes.post('/', authorize('recepcionista', 'admin'), criarClienteHandler);

// Atualizar: recepcionista/admin ou o próprio cliente autenticado (ownership na service).
clienteRoutes.put('/:id', authenticate, atualizarClienteHandler);

export default clienteRoutes;
