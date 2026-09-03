import bcrypt from 'bcrypt';
import { env } from '../../../config/env.js';
import { generateTokenPair, verifyRefreshToken } from '../../../shared/utils/jwt.js';
import { usuarioRepository, UsuarioCreateInput } from '../repositories/usuario.repository.js';
import { UnauthorizedError, ConflictError } from '../../../shared/errors/AppError.js';
import { TipoUsuario } from '../../../shared/types/auth.js';

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, env.BCRYPT_COST);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async cadastro(data: UsuarioCreateInput & { tipo: TipoUsuario; isAdminCreating: boolean }) {
    const existingUser = await usuarioRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError('Email já cadastrado');
    }

    const userCount = await usuarioRepository.count();

    if (!data.isAdminCreating && data.tipo !== 'CLIENTE') {
      if (userCount === 0 && data.tipo === 'ADMINISTRADOR') {
        // Allow first user to be admin
      } else {
        throw new UnauthorizedError('Apenas administradores podem criar usuários não-clientes');
      }
    }

    const { isAdminCreating, senhaHash, ...createData } = data;
    const hashedPassword = await this.hashPassword(senhaHash);
    const usuario = await usuarioRepository.create({
      ...createData,
      senhaHash: hashedPassword,
    });

    const tokens = generateTokenPair(usuario.id, usuario.tipo as TipoUsuario);
    await usuarioRepository.update(usuario.id, { refreshToken: tokens.refreshToken });

    return {
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        tipo: usuario.tipo as TipoUsuario,
      },
      ...tokens,
    };
  }

  async login(email: string, senha: string) {
    const usuario = await usuarioRepository.findByEmail(email);
    if (!usuario) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    if (!usuario.ativo) {
      throw new UnauthorizedError('Usuário inativo');
    }

    const isValid = await this.comparePassword(senha, usuario.senhaHash);
    if (!isValid) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    const tokens = generateTokenPair(usuario.id, usuario.tipo as TipoUsuario);
    await usuarioRepository.update(usuario.id, { refreshToken: tokens.refreshToken });

    return {
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        tipo: usuario.tipo as TipoUsuario,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    let payload: { sub: string; tipo: TipoUsuario };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Refresh token inválido ou expirado');
    }

    const usuario = await usuarioRepository.findByRefreshToken(refreshToken);
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedError('Refresh token inválido ou expirado');
    }

    const tokens = generateTokenPair(usuario.id, usuario.tipo as TipoUsuario);
    await usuarioRepository.update(usuario.id, { refreshToken: tokens.refreshToken });

    return tokens;
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    const usuario = await usuarioRepository.findByRefreshToken(refreshToken);
    if (usuario) {
      await usuarioRepository.update(usuario.id, { refreshToken: null });
    }
  }
}

export const authService = new AuthService();