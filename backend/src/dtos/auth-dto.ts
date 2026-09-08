export interface UsuarioDTO {
  id: string;
  email: string;
  tipo: string;
  nome: string | null;
  cargo?: string | null;
  avatarUrl?: string | null;
}

export interface LoginResponseDTO {
  token: string;
  user: UsuarioDTO;
  role: string;
  precisaTrocarSenha?: boolean;
}

export interface GoogleLoginRequestDTO {
  idToken: string;
}

export interface LoginLocalRequestDTO {
  email: string;
  senha?: string;
  password?: string;
}