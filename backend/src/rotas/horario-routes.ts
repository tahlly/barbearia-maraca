import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import {
  listarHorarios,
  obterDisponibilidade,
  criarHorario,
  atualizarHorario,
  excluirHorario,
} from '../controllers/horario-controller';

const horarioRoutes = Router();

// Aplicar autenticação em todo o domínio de horários (os RBACs de agenda são
// aplicados no service/controller, conforme o papel do usuário autenticado).
horarioRoutes.use(authenticate);

horarioRoutes.get('/', listarHorarios);
horarioRoutes.get('/funcionario-disponibilidade', obterDisponibilidade);
horarioRoutes.post('/', criarHorario);
horarioRoutes.put('/:id', atualizarHorario);
horarioRoutes.delete('/:id', excluirHorario);

export default horarioRoutes;
