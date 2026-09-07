import './env';
import jwt, { type SignOptions } from 'jsonwebtoken';

const DEV_SECRET = 'dev-secret-nao-usar-em-producao';

function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  const insecure =
    !configured || configured.trim() === '' || configured === DEV_SECRET;

  if (isProduction) {
    if (insecure) {
      throw new Error(
        'JWT_SECRET é obrigatório em produção. Defina JWT_SECRET com um valor forte e privado antes de iniciar a aplicação.',
      );
    }
    return configured;
  }

  if (insecure) {
    console.warn(
      '[config/jwt] Aviso: JWT_SECRET não definido. Usando segredo de desenvolvimento inseguro — defina JWT_SECRET antes de produção.',
    );
    return DEV_SECRET;
  }

  return configured;
}

export const JWT_SECRET = resolveJwtSecret();
export const JWT_EXPIRES_IN: SignOptions['expiresIn'] =
  (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn'] | undefined) ?? '30m';

export interface JwtPayload {
  sub: string;
  id: string;
  tipo: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
  };
  return jwt.sign(payload, JWT_SECRET, options);
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.sub === 'string' &&
    typeof record.id === 'string' &&
    typeof record.tipo === 'string' &&
    typeof record.role === 'string'
  );
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (!isJwtPayload(decoded)) {
    throw new Error('Payload do token inválido');
  }
  return decoded;
}
