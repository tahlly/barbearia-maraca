export type TipoUsuario = 'CLIENTE' | 'BARBEIRO' | 'RECEPCIONISTA' | 'ADMINISTRADOR';

export interface CadastroRequest {
  email: string;
  senha: string;
  nome: string;
  tipo: TipoUsuario;
}

export interface CadastroResponse {
  id: string;
  email: string;
  nome: string;
  tipo: TipoUsuario;
}

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  usuario: {
    id: string;
    email: string;
    nome: string;
    tipo: TipoUsuario;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface JWTPayload {
  sub: string;
  tipo: TipoUsuario;
  email: string;
  nome: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}