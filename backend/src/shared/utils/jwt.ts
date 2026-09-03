import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { JWTPayload, TokenPair, TipoUsuario } from '../types/auth.js';

export function generateAccessToken(userId: string, tipo: TipoUsuario): string {
  return jwt.sign({ sub: userId, tipo }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function generateRefreshToken(userId: string, tipo: TipoUsuario): string {
  return jwt.sign({ sub: userId, tipo }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function generateTokenPair(userId: string, tipo: TipoUsuario): TokenPair {
  return {
    accessToken: generateAccessToken(userId, tipo),
    refreshToken: generateRefreshToken(userId, tipo),
  };
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}