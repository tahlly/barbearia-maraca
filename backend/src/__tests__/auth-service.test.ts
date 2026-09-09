import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { ForbiddenError } from '../errors/ForbiddenError';

// Mock da camada de persistência para isolar o service de regras de negócio.
const findUsuarioByIdMock = vi.fn();
const findUsuarioByEmailMock = vi.fn();
const obterFuncionarioNomeMock = vi.fn();

let ultimoUpdateUsuario: Record<string, unknown> | undefined;

const usuarioTableMock = {
  where: vi.fn(() => ({
    update: (obj: Record<string, unknown>) => {
      ultimoUpdateUsuario = obj;
      return Promise.resolve(1);
    },
  })),
};
const clienteTableMock = {
  where: vi.fn(() => ({ update: vi.fn(async () => 1) })),
};
const funcionarioTableMock = {
  where: vi.fn(() => ({ update: vi.fn(async () => 1) })),
};
// `trx` no Knex é um objeto chamável: trx('usuario') devolve a query da tabela.
const trxFn = (table: string) => {
  if (table === 'usuario') return usuarioTableMock;
  if (table === 'cliente') return clienteTableMock;
  return funcionarioTableMock;
};
const transactionMock = vi.fn(async (cb: (trx: typeof trxFn) => Promise<void>) => {
  await cb(trxFn);
});

vi.mock('../database/connection', () => ({
  default: {
    transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

vi.mock('../repositories/auth-repository', () => ({
  findUsuarioById: (...args: unknown[]) => findUsuarioByIdMock(...args),
  findUsuarioByEmail: (...args: unknown[]) => findUsuarioByEmailMock(...args),
  findUsuarioByGoogleId: vi.fn(),
  criarUsuarioGoogle: vi.fn(),
  criarUsuarioComSenha: vi.fn(),
  vincularGoogleAUsuario: vi.fn(),
  criarCliente: vi.fn(),
  criarClienteCompleto: vi.fn(),
  obterClienteNome: vi.fn(),
  obterFuncionarioNome: (...args: unknown[]) => obterFuncionarioNomeMock(...args),
  salvarTokenResetSenha: vi.fn(),
  findUsuarioByResetTokenHash: vi.fn(),
}));

// Comparação de hash conhecida (evita bcrypt real): igual se senha === hash.
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(async (senha: string, hash: string) => senha === hash),
    hash: vi.fn(async (senha: string) => `hash:${senha}`),
  },
}));

import { atualizarPerfil, login } from '../services/auth-service';
import type { UsuarioRow } from '../repositories/auth-repository';

const BASE_USUARIO: UsuarioRow = {
  id: 'u1',
  email: 'barbeiro@email.com',
  senha_hash: 'hash:123456',
  tipo: 'funcionario',
  google_id: null,
  avatar_url: null,
  reset_token_hash: null,
  reset_token_expires_at: null,
  primeiro_acesso: true,
};

describe('atualizarPerfil — primeiro acesso (P4)', () => {
  beforeEach(() => {
    findUsuarioByIdMock.mockReset();
    findUsuarioByEmailMock.mockReset();
    transactionMock.mockClear();
    ultimoUpdateUsuario = undefined;
  });

  it('primeiro acesso com novaSenha sem senhaAtual → sucesso (primeiro_acesso=false)', async () => {
    findUsuarioByIdMock.mockResolvedValue(BASE_USUARIO);

    const resultado = await atualizarPerfil('u1', { novaSenha: 'SenhaNova!123' });

    expect(resultado.email).toBe('barbeiro@email.com');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    // Grava nova senha e encerra o primeiro acesso.
    expect(ultimoUpdateUsuario?.['senha_hash']).toBe('hash:SenhaNova!123');
    expect(ultimoUpdateUsuario?.['primeiro_acesso']).toBe(false);
  });

  it('troca voluntária sem senhaAtual → ainda 401 (exige credencial)', async () => {
    findUsuarioByIdMock.mockResolvedValue({ ...BASE_USUARIO, primeiro_acesso: false });

    await expect(
      atualizarPerfil('u1', { novaSenha: 'SenhaNova!123' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('troca voluntária com senhaAtual incorreta → 401', async () => {
    findUsuarioByIdMock.mockResolvedValue({ ...BASE_USUARIO, primeiro_acesso: false });

    await expect(
      atualizarPerfil('u1', { senhaAtual: 'senha-errada', novaSenha: 'SenhaNova!123' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('troca voluntária com senhaAtual correta → sucesso', async () => {
    findUsuarioByIdMock.mockResolvedValue({ ...BASE_USUARIO, primeiro_acesso: false });

    const resultado = await atualizarPerfil('u1', {
      senhaAtual: 'hash:123456',
      novaSenha: 'SenhaNova!123',
    });

    expect(resultado.email).toBe('barbeiro@email.com');
    expect(ultimoUpdateUsuario?.['primeiro_acesso']).toBe(false);
  });

  it('mudança de e-mail com senha existente ainda exige senhaAtual', async () => {
    findUsuarioByIdMock.mockResolvedValue({ ...BASE_USUARIO, primeiro_acesso: false });

    await expect(
      atualizarPerfil('u1', { email: 'novo@email.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('login — funcionário desativado (fix)', () => {
  beforeEach(() => {
    findUsuarioByEmailMock.mockReset();
    obterFuncionarioNomeMock.mockReset();
  });

  it('funcionário ativo → login gera token e role profissional', async () => {
    findUsuarioByEmailMock.mockResolvedValue({
      ...BASE_USUARIO,
      senha_hash: 'hash:123456',
      primeiro_acesso: false,
    });
    obterFuncionarioNomeMock.mockResolvedValue({ nome: 'Barbeiro A', cargo: 'barbeiro', ativo: true });

    const resultado = await login({ email: 'barbeiro@email.com', senha: 'hash:123456' });

    expect(resultado.token).toBeTruthy();
    expect(resultado.role).toBe('profissional');
    expect(resultado.user.cargo).toBe('barbeiro');
  });

  it('funcionário inativo → ForbiddenError sem gerar token', async () => {
    findUsuarioByEmailMock.mockResolvedValue({
      ...BASE_USUARIO,
      senha_hash: 'hash:123456',
      primeiro_acesso: false,
    });
    obterFuncionarioNomeMock.mockResolvedValue({ nome: 'Barbeiro A', cargo: 'barbeiro', ativo: false });

    await expect(
      login({ email: 'barbeiro@email.com', senha: 'hash:123456' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('funcionário inexistente/inválido → UnauthorizedError sem consultar nome/cargo', async () => {
    findUsuarioByEmailMock.mockResolvedValue(null);

    await expect(
      login({ email: 'sumido@email.com', senha: 'hash:123456' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(obterFuncionarioNomeMock).not.toHaveBeenCalled();
  });

  it('funcionário sem linha em funcionario (linha ausente) → ForbiddenError sem token', async () => {
    findUsuarioByEmailMock.mockResolvedValue({
      ...BASE_USUARIO,
      senha_hash: 'hash:123456',
      primeiro_acesso: false,
    });
    obterFuncionarioNomeMock.mockResolvedValue(null);

    await expect(
      login({ email: 'barbeiro@email.com', senha: 'hash:123456' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(obterFuncionarioNomeMock).toHaveBeenCalled();
  });

  it('funcionário com ativo null/ausente (conta inconsistente) → ForbiddenError sem token', async () => {
    findUsuarioByEmailMock.mockResolvedValue({
      ...BASE_USUARIO,
      senha_hash: 'hash:123456',
      primeiro_acesso: false,
    });
    obterFuncionarioNomeMock.mockResolvedValue({ nome: 'Barbeiro A', cargo: 'barbeiro', ativo: null });

    await expect(
      login({ email: 'barbeiro@email.com', senha: 'hash:123456' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
