import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { ValidationError } from '../errors/ValidationError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { InternalError } from '../errors/InternalError';
import { UnauthorizedError } from '../errors/UnauthorizedError';

export interface ErrorResponse {
  erro: boolean;
  mensagem: string;
  status: number;
  detalhes?: unknown;
}

function formatZodError(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${path}: ${issue.message}`;
  });
  return issues.join('; ');
}

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[ERROR]', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });

  let response: ErrorResponse;

  // Qualquer AppError (incluindo UnauthorizedError 401 e ForbiddenError 403)
  // responde com o próprio status, sem conversão adicional.
  if (error instanceof AppError) {
    response = {
      erro: true,
      mensagem: error.message,
      status: error.status,
    };

    if (error instanceof ValidationError && error.details) {
      response.detalhes = error.details;
    }

    res.status(error.status).json(response);
    return;
  }

  if (error instanceof ZodError) {
    const validationError = new ValidationError('Dados inválidos', formatZodError(error));
    response = {
      erro: true,
      mensagem: validationError.message,
      status: validationError.status,
      detalhes: validationError.details,
    };
    res.status(validationError.status).json(response);
    return;
  }

  // Bloco legado para erros 401 genéricos de bibliotecas externas (ex.: jwt).
  // Não altera o status de AppError, tratado acima; aqui o correto é 401 e
  // nunca converter um não-autenticado em 403.
  if (error.name === 'UnauthorizedError' || error.message.toLowerCase().includes('jwt')) {
    const unauthorizedError = new UnauthorizedError('Token inválido ou expirado');
    response = {
      erro: true,
      mensagem: unauthorizedError.message,
      status: unauthorizedError.status,
    };
    res.status(unauthorizedError.status).json(response);
    return;
  }

  const internalError = new InternalError();
  response = {
    erro: true,
    mensagem: internalError.message,
    status: internalError.status,
  };
  res.status(internalError.status).json(response);
}
