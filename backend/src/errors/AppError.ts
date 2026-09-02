export class AppError extends Error {
  public readonly status: number;
  public readonly erro: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.erro = true;
    Error.captureStackTrace(this, this.constructor);
  }
}