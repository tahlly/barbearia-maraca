import { AppError } from './AppError';

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Não autenticado') {
    super(message, 401);
  }
}
