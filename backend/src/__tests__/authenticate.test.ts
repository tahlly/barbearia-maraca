import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate } from '../middlewares/authenticate';
import type { Request, Response } from 'express';
import { UnauthorizedError } from '../errors/UnauthorizedError';

// ── Mocks ─────────────────────────────────────────────────────

const verifyTokenMock = vi.fn();
const buscarPorUsuarioIdMock = vi.fn();

// Espelha o mapeamento real de cargo → role (mesma lógica de auth-service),
// isolando o middleware do restante da camada de serviços.
const mapearTipoParaRoleMock = vi.fn(
  (tipo: string, cargo?: string | null): string => {
    if (tipo === 'cliente') return 'cliente';
    if (cargo === 'administrador') return 'admin';
    if (cargo === 'recepcionista') return 'recepcionista';
    return 'profissional';
  },
);

vi.mock('../config/jwt', () => ({
  verifyToken: (...args: unknown[]) => verifyTokenMock(...args),
}));

vi.mock('../repositories/funcionario-repository', () => ({
  buscarPorUsuarioId: (...args: unknown[]) => buscarPorUsuarioIdMock(...args),
}));

vi.mock('../services/auth-service', () => ({
  mapearTipoParaRole: (...args: unknown[]) => mapearTipoParaRoleMock(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

/** Executa o middleware com um req minimalista (Bearer token-x) e retorna req/next. */
async function executar(): Promise<{ req: Request & { user?: { id: string; tipo: string; role: string } }; next: ReturnType<typeof vi.fn> }> {
  const req = {
    headers: { authorization: 'Bearer token-x' },
    user: undefined,
  } as Request & { user?: { id: string; tipo: string; role: string } };
  const next = vi.fn();
  await authenticate(req, {} as Response, next);
  return { req, next };
}

// ── Cenários ──────────────────────────────────────────────────

describe('authenticate — revalida cargo do banco (Fase B)', () => {
  it('sincroniza req.user.role com o cargo atual do banco (token admin + cargo barbeiro → profissional)', async () => {
    verifyTokenMock.mockReturnValue({ sub: 'u1', id: 'u1', tipo: 'funcionario', role: 'admin' });
    buscarPorUsuarioIdMock.mockResolvedValue({
      id: 'f1',
      usuario_id: 'u1',
      cargo: 'barbeiro',
      ativo: true,
    });

    const { req, next } = await executar();

    expect(mapearTipoParaRoleMock).toHaveBeenCalledWith('funcionario', 'barbeiro');
    expect(req.user?.role).toBe('profissional');
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('bloqueia funcionário inativo com UnauthorizedError (token não é aceito)', async () => {
    verifyTokenMock.mockReturnValue({ sub: 'u1', id: 'u1', tipo: 'funcionario', role: 'admin' });
    buscarPorUsuarioIdMock.mockResolvedValue({
      id: 'f1',
      usuario_id: 'u1',
      cargo: 'administrador',
      ativo: false,
    });

    const { next } = await executar();

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(mapearTipoParaRoleMock).not.toHaveBeenCalled();
  });

  it('bloqueia requisição sem linha de funcionário (consistência ausente) com UnauthorizedError', async () => {
    verifyTokenMock.mockReturnValue({ sub: 'u1', id: 'u1', tipo: 'funcionario', role: 'admin' });
    buscarPorUsuarioIdMock.mockResolvedValue(null);

    const { next } = await executar();

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('mantém role do token para cliente e não consulta a tabela de funcionários', async () => {
    verifyTokenMock.mockReturnValue({ sub: 'c1', id: 'c1', tipo: 'cliente', role: 'cliente' });

    const { req, next } = await executar();

    expect(buscarPorUsuarioIdMock).not.toHaveBeenCalled();
    expect(mapearTipoParaRoleMock).not.toHaveBeenCalled();
    expect(req.user?.role).toBe('cliente');
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});