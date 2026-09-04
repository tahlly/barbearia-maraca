import { Router } from 'express';
import { authenticate, authenticateOptional } from '../middlewares/authenticate';
import {
  listarHorarios,
  obterDisponibilidade,
  criarHorario,
  atualizarHorario,
  excluirHorario,
} from '../controllers/horario-controller';

const horarioRoutes = Router();

// Disponibilidade é pública (horários de funcionamento + slots ocupados) para
// permitir o booking wizard sem login. Registrada antes do `use(authenticate)`
// para não exigir token; se houver token válido, o usuário é anexado ao request.
horarioRoutes.get('/funcionario-disponibilidade', authenticateOptional, obterDisponibilidade);

// Aplicar autenticação no restante do domínio de horários (os RBACs de agenda
// são aplicados no service/controller, conforme o papel do usuário autenticado).
horarioRoutes.use(authenticate);

horarioRoutes.get('/', listarHorarios);
horarioRoutes.post('/', criarHorario);
horarioRoutes.put('/:id', atualizarHorario);
horarioRoutes.delete('/:id', excluirHorario);

export default horarioRoutes;
