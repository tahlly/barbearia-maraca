import { AppError } from './AppError';

export class NotFoundError extends AppError {
  constructor(message: string = 'Rota não encontrada') {
    super(message, 404);
  }
}