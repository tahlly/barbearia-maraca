import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import type { FuncionarioCompletoDTO } from '../dtos/funcionario-dto';

const buscarPorIdMock = vi.fn();
const atualizarRepoMock = vi.fn();
const trocarStatusMock = vi.fn();
const findUsuarioByEmailMock = vi.fn();

vi.mock('../repositories/funcionario-repository', () => ({
  buscarPorId: (...args: unknown[]) => buscarPorIdMock(...args),
  atualizar: (...args: unknown[]) => atualizarRepoMock(...args),
  trocarStatus: (...args: unknown[]) => trocarStatusMock(...args),
}));

vi.mock('../repositories/auth-repository', () => ({
  findUsuarioByEmail: (...args: unknown[]) => findUsuarioByEmailMock(...args),
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(async () => true),
    hash: vi.fn(async (senha: string) => `hash:${senha}`),
  },
}));

const { atualizarFuncionario, alternarStatusFuncionario } = await import(
  '../services/funcionario-service'
);

const BASE_ALVO: FuncionarioCompletoDTO = {
  id: 'f1',
  usuarioId: 'u1',
  nome: 'Barbeiro A',
  telefone: null,
  cargo: 'barbeiro',
  especialidade: null,
  foto: null,
  descricao: null,
  ativo: true,
  email: 'barbeiro@email.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  categorias: [],
};

function alvoCargo(cargo: string, id = 'f1', usuarioId = 'u1'): FuncionarioCompletoDTO {
  return { ...BASE_ALVO, id, usuarioId, cargo };
}

describe('atualizarFuncionario — regra hierárquica de edição', () => {
  beforeEach(() => {
    buscarPorIdMock.mockReset();
    atualizarRepoMock.mockReset();
    findUsuarioByEmailMock.mockReset();
  });

  it('admin edita outro administrador → sucesso', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('administrador', 'f2', 'u2'));
    atualizarRepoMock.mockResolvedValue(alvoCargo('administrador', 'f2', 'u2'));

    const resultado = await atualizarFuncionario(
      'f2',
      { nome: 'Admin Editado' },
      'u1',
      'admin',
    );

    expect(resultado.cargo).toBe('administrador');
    expect(atualizarRepoMock).toHaveBeenCalledTimes(1);
  });

  it('admin tentando editar o próprio cadastro → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('administrador', 'f1', 'u1'));

    await expect(
      atualizarFuncionario('f1', { nome: 'Eu' }, 'u1', 'admin'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });

  it('recepcionista edita barbeiro → sucesso', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('barbeiro'));
    atualizarRepoMock.mockResolvedValue({ ...alvoCargo('barbeiro'), telefone: '11999999999' });

    const resultado = await atualizarFuncionario(
      'f1',
      { telefone: '11999999999' },
      'u-recep',
      'recepcionista',
    );

    expect(resultado.telefone).toBe('11999999999');
    expect(atualizarRepoMock).toHaveBeenCalledTimes(1);
  });

  it('recepcionista tentando editar recepcionista → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('recepcionista', 'f2', 'u2'));

    await expect(
      atualizarFuncionario('f2', { nome: 'Colega' }, 'u-recep', 'recepcionista'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });

  it('recepcionista tentando editar administrador → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('administrador', 'f2', 'u2'));

    await expect(
      atualizarFuncionario('f2', { nome: 'Chefe' }, 'u-recep', 'recepcionista'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });

  it('alvo inexistente → NotFoundError antes de qualquer atualização', async () => {
    buscarPorIdMock.mockResolvedValue(null);

    await expect(
      atualizarFuncionario('f-x', { nome: 'X' }, 'u1', 'admin'),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(atualizarRepoMock).not.toHaveBeenCalled();
  });
});

describe('alternarStatusFuncionario — regra hierárquica de status', () => {
  beforeEach(() => {
    buscarPorIdMock.mockReset();
    trocarStatusMock.mockReset();
  });

  it('admin aplica em outro admin → sucesso', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('administrador', 'f2', 'u2'));
    trocarStatusMock.mockResolvedValue(true);

    const resultado = await alternarStatusFuncionario('f2', false, 'u1', 'admin');

    expect(resultado).toBe(true);
    expect(trocarStatusMock).toHaveBeenCalledWith('f2', false);
  });

  it('ninguém pode alterar o próprio status → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('barbeiro', 'f1', 'u1'));

    await expect(
      alternarStatusFuncionario('f1', false, 'u1', 'admin'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(trocarStatusMock).not.toHaveBeenCalled();
  });

  it('recepcionista aplica em barbeiro → sucesso', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('barbeiro'));
    trocarStatusMock.mockResolvedValue(true);

    const resultado = await alternarStatusFuncionario('f1', false, 'u-recep', 'recepcionista');

    expect(resultado).toBe(true);
  });

  it('recepcionista em recepcionista → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('recepcionista', 'f2', 'u2'));

    await expect(
      alternarStatusFuncionario('f2', false, 'u-recep', 'recepcionista'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(trocarStatusMock).not.toHaveBeenCalled();
  });

  it('recepcionista em administrador → ForbiddenError', async () => {
    buscarPorIdMock.mockResolvedValue(alvoCargo('administrador', 'f2', 'u2'));

    await expect(
      alternarStatusFuncionario('f2', false, 'u-recep', 'recepcionista'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(trocarStatusMock).not.toHaveBeenCalled();
  });

  it('alvo inexistente → NotFoundError', async () => {
    buscarPorIdMock.mockResolvedValue(null);

    await expect(
      alternarStatusFuncionario('f-x', false, 'u1', 'admin'),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(trocarStatusMock).not.toHaveBeenCalled();
  });
});