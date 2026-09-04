import { Router } from 'express';
import { loginComGoogle, registrarUsuario } from '../controllers/auth-controller';

const authRoutes = Router();

authRoutes.post('/google', loginComGoogle);
authRoutes.post('/register', registrarUsuario);

export default authRoutes;
