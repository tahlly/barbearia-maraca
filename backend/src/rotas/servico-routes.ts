import { Router } from 'express';
import { listarServicos } from '../controllers/servico-controller';

const servicoRoutes = Router();

servicoRoutes.get('/', listarServicos);

export default servicoRoutes;