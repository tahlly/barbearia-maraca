import { Router } from 'express';
import {
  loginComGoogle,
  registrarUsuario,
  loginLocal,
  logout,
  atualizarPerfilHandler,
} from '../controllers/auth-controller';
import { authenticate } from '../middlewares/authenticate';

const authRoutes = Router();

authRoutes.post('/google', loginComGoogle);
authRoutes.post('/register', registrarUsuario);
authRoutes.post('/login', loginLocal);
authRoutes.post('/logout', logout);
authRoutes.patch('/me', authenticate, atualizarPerfilHandler);

export default authRoutes;
