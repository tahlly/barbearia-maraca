import { Router } from 'express';
import { loginComGoogle } from '../controllers/auth-controller';

const authRoutes = Router();

authRoutes.post('/google', loginComGoogle);

export default authRoutes;
