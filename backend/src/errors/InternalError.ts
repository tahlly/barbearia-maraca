import { AppError } from './AppError';

export class InternalError extends AppError {
  constructor(message: string = 'Erro interno do servidor') {
    super(message, 500);
  }
}