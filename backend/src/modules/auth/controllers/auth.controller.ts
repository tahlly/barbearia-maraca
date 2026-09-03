import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service.js';
import { CadastroDTO, LoginDTO, RefreshTokenDTO, LogoutDTO } from '../dto/auth.dto.js';
import { UnauthorizedError } from '../../../shared/errors/AppError.js';

export class AuthController {
  async cadastro(request: FastifyRequest, reply: FastifyReply) {
    const isAdminCreating = request.user?.tipo === 'ADMINISTRADOR';
    const body = request.body as CadastroDTO;
    const { senha, ...rest } = body;
    const result = await authService.cadastro({ ...rest, senhaHash: senha, isAdminCreating });
    return reply.status(201).send(result);
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as LoginDTO;
    const result = await authService.login(body.email, body.senha);
    return reply.send(result);
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as RefreshTokenDTO;
    const result = await authService.refreshToken(body.refreshToken);
    return reply.send(result);
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as LogoutDTO;
    await authService.logout(body.refreshToken);
    return reply.status(204).send();
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      throw new UnauthorizedError('Não autenticado');
    }
    return reply.send({
      id: request.user.sub,
      email: request.user.email,
      nome: request.user.nome,
      tipo: request.user.tipo,
    });
  }
}

export const authController = new AuthController();