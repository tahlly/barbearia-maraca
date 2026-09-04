import jwt, { type SignOptions } from 'jsonwebtoken';

const DEV_SECRET = 'dev-secret-nao-usar-em-producao';

export const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;
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
