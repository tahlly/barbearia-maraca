import 'express';
import type { Papel, UsuarioDTO } from '../dtos/auth-dto';

declare global {
  namespace Express {
    interface Request {
      /**
       * Usuário autenticado populado pelo middleware `autenticar`.
       * Ausente quando a requisição não passou pelo middleware.
       */
      usuario?: UsuarioDTO;
      /**
       * Papel funcional derivado no backend pelo middleware `autenticar`.
       * Ausente quando a requisição não passou pelo middleware.
       */
      papel?: Papel;
    }
  }
}

export {};
