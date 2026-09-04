import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import {
  criarHandler,
  listarHandler,
  obterHandler,
  cancelarHandler,
  confirmarHandler,
  concluirHandler,
} from '../controllers/agendamento-controller';

const agendamentoRoutes = Router();

agendamentoRoutes.post('/', authenticate, criarHandler);
agendamentoRoutes.get('/', authenticate, listarHandler);
agendamentoRoutes.get('/:id', authenticate, obterHandler);
agendamentoRoutes.patch('/:id/cancelar', authenticate, cancelarHandler);
agendamentoRoutes.patch(
  '/:id/confirmar',
  authorize('profissional', 'recepcionista', 'admin'),
  confirmarHandler,
);
agendamentoRoutes.patch(
  '/:id/concluir',
  authorize('profissional', 'recepcionista', 'admin'),
  concluirHandler,
);

export default agendamentoRoutes;
