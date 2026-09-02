import { AppError } from './AppError';

export class ValidationError extends AppError {
  public readonly details?: unknown;

  constructor(message: string = 'Dados inválidos', details?: unknown) {
    super(message, 400);
    this.details = details;
  }
}