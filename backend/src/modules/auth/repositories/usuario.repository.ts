import { prisma } from '../../../shared/utils/prisma.js';
import { TipoUsuario } from '../../../shared/types/auth.js';

export interface UsuarioCreateInput {
  email: string;
  senhaHash: string;
  nome: string;
  tipo: TipoUsuario;
}

export interface UsuarioFindUniqueInput {
  id?: string;
  email?: string;
  refreshToken?: string;
}

export interface UsuarioUpdateInput {
  senhaHash?: string;
  refreshToken?: string | null;
  ativo?: boolean;
  nome?: string;
}

export class UsuarioRepository {
  async create(data: UsuarioCreateInput) {
    return prisma.usuario.create({ data });
  }

  async findByEmail(email: string) {
    return prisma.usuario.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return prisma.usuario.findUnique({ where: { id } });
  }

  async findByRefreshToken(refreshToken: string) {
    return prisma.usuario.findUnique({ where: { refreshToken } });
  }

  async update(id: string, data: UsuarioUpdateInput) {
    return prisma.usuario.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.usuario.delete({ where: { id } });
  }

  async count() {
    return prisma.usuario.count();
  }
}

export const usuarioRepository = new UsuarioRepository();