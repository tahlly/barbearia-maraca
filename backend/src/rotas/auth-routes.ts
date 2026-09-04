import { Router } from 'express';
import { loginComGoogle, loginLocal, obterUsuarioAutenticado } from '../controllers/auth-controller';
import { autenticar, autorizarPapel } from '../middlewares/autenticacao';
import type { Papel } from '../dtos/auth-dto';

const TODOS_OS_PAPEIS: Papel[] = ['admin', 'recepcionista', 'profissional', 'cliente'];

const authRoutes = Router();

authRoutes.post('/login', loginLocal);
authRoutes.post('/google', loginComGoogle);

// Rota privada PoC: exige token válido (autenticar) e permite qualquer papel autenticado.
authRoutes.get('/me', autenticar, autorizarPapel(...TODOS_OS_PAPEIS), obterUsuarioAutenticado);

export default authRoutes;
