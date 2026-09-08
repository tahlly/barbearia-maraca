import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listarExcecoes,
  criarExcecao,
  atualizarExcecao,
  excluirExcecao,
} from '../services/horario-excecao-service';
import {
  listarExcecoes as listarExcecoesRepo,
  buscarExcecaoPorId,
  buscarFuncionarioPorId,
  buscarFuncionarioPorUsuarioId,
  criarExcecao as criarExcecaoRepo,
  atualizarExcecao as atualizarExcecaoRepo,
  excluirExcecao as excluirExcecaoRepo,
} from '../repositories/horario-excecao-repository';
import type { HorarioExcecao } from '../dtos/horario-excecao-dto';
import type { FuncionarioMin } from '../dtos/horario-dto';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';

vi.mock('../repositories/horario-excecao-repository', () => ({
  listarExcecoes: vi.fn(),
  buscarExcecaoPorId: vi.fn(),
  buscarFuncionarioPorId: vi.fn(),
  buscarFuncionarioPorUsuarioId: vi.fn(),
  criarExcecao: vi.fn(),
  atualizarExcecao: vi.fn(),
  excluirExcecao: vi.fn(),
}));

const funcionario: FuncionarioMin = {
  id: 'func-1',
  nome: 'Barbeiro 1',
  ativo: true,
};

const excecao: HorarioExcecao = {
  id: 'exc-1',
  funcionario_id: 'func-1',
  funcionario_nome: 'Barbeiro 1',
  data: '2026-09-12',
  hora_inicio: '09:00',
  hora_fim: '18:00',
  tipo: 'bloqueio',
  motivo: null,
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-01T10:00:00.000Z',
};

function usuario(role: string) {
  return { id: 'user-1', tipo: role, role };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarFuncionarioPorUsuarioId).mockResolvedValue(funcionario);
});

describe('criarExcecao', () => {
  it('bloqueia cliente (papel sem acesso à agenda)', async () => {
    await expect(
      criarExcecao(usuario('cliente'), {
        funcionario_id: 'func-1',
        data: '2026-09-12',
        hora_inicio: '09:00',
        hora_fim: '18:00',
        tipo: 'bloqueio',
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('bloqueia profissional tentando criar em agenda de outro', async () => {
    await expect(
      criarExcecao(usuario('profissional'), {
        funcionario_id: 'func-999',
        data: '2026-09-12',
        hora_inicio: '09:00',
        hora_fim: '18:00',
        tipo: 'bloqueio',
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('valida que hora_fim deve ser maior que hora_inicio', async () => {
    await expect(
      criarExcecao(usuario('admin'), {
        funcionario_id: 'func-1',
        data: '2026-09-12',
        hora_inicio: '18:00',
        hora_fim: '09:00',
        tipo: 'bloqueio',
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('lança NotFoundError quando o funcionário não existe', async () => {
    vi.mocked(buscarFuncionarioPorId).mockResolvedValue(null);

    await expect(
      criarExcecao(usuario('recepcionista'), {
        funcionario_id: 'func-999',
        data: '2026-09-12',
        hora_inicio: '09:00',
        hora_fim: '18:00',
        tipo: 'bloqueio',
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('cria e normaliza a resposta (data/hora)', async () => {
    vi.mocked(buscarFuncionarioPorId).mockResolvedValue(funcionario);
    vi.mocked(criarExcecaoRepo).mockResolvedValue({
      ...excecao,
      hora_inicio: '09:00:00',
      hora_fim: '18:00:00',
    });

    const resultado = await criarExcecao(usuario('recepcionista'), {
      funcionario_id: 'func-1',
      data: '2026-09-12',
      hora_inicio: '09:00',
      hora_fim: '18:00',
      tipo: 'bloqueio',
    });

    expect(criarExcecaoRepo).toHaveBeenCalledTimes(1);
    expect(resultado.hora_inicio).toBe('09:00');
    expect(resultado.hora_fim).toBe('18:00');
    expect(resultado.data).toBe('2026-09-12');
  });
});

describe('atualizarExcecao', () => {
  it('lança NotFoundError quando a exceção não existe', async () => {
    vi.mocked(buscarExcecaoPorId).mockResolvedValue(null);

    await expect(atualizarExcecao(usuario('admin'), 'exc-999', { motivo: 'x' })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it('bloqueia cliente', async () => {
    vi.mocked(buscarExcecaoPorId).mockResolvedValue(excecao);

    await expect(atualizarExcecao(usuario('cliente'), 'exc-1', { motivo: 'x' })).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it('recalcula o intervalo usando a hora existente quando só um lado muda', async () => {
    vi.mocked(buscarExcecaoPorId).mockResolvedValue({ ...excecao, hora_inicio: '09:00', hora_fim: '18:00' });

    await expect(
      atualizarExcecao(usuario('admin'), 'exc-1', { hora_fim: '08:00' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('atualiza e normaliza a resposta', async () => {
    vi.mocked(buscarExcecaoPorId).mockResolvedValue(excecao);
    vi.mocked(atualizarExcecaoRepo).mockResolvedValue({ ...excecao, motivo: 'Manutenção' });

    const resultado = await atualizarExcecao(usuario('admin'), 'exc-1', { motivo: 'Manutenção' });

    expect(atualizarExcecaoRepo).toHaveBeenCalledTimes(1);
    expect(resultado.motivo).toBe('Manutenção');
    expect(resultado.hora_inicio).toBe('09:00');
  });
});

describe('listarExcecoes', () => {
  it('força o próprio funcionario_id para profissional', async () => {
    vi.mocked(listarExcecoesRepo).mockResolvedValue([excecao]);

    await listarExcecoes(usuario('profissional'), {});

    expect(listarExcecoesRepo).toHaveBeenCalledWith(
      expect.objectContaining({ funcionarioId: 'func-1' })
    );
  });

  it('bloqueia cliente', async () => {
    await expect(listarExcecoes(usuario('cliente'), {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('repassa filtros para admin', async () => {
    vi.mocked(listarExcecoesRepo).mockResolvedValue([excecao]);

    await listarExcecoes(usuario('admin'), {
      funcionario_id: 'func-2',
      data: '2026-09-10',
      tipo: 'liberacao',
    });

    expect(listarExcecoesRepo).toHaveBeenCalledWith({
      funcionarioId: 'func-2',
      data: '2026-09-10',
      tipo: 'liberacao',
    });
  });
});

describe('excluirExcecao', () => {
  it('lança NotFoundError quando a exceção não existe', async () => {
    vi.mocked(buscarExcecaoPorId).mockResolvedValue(null);

    await expect(excluirExcecao(usuario('admin'), 'exc-999')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('permite profissional excluir da própria agenda', async () => {
    vi.mocked(buscarExcecaoPorId).mockResolvedValue(excecao);

    await excluirExcecao(usuario('profissional'), 'exc-1');

    expect(excluirExcecaoRepo).toHaveBeenCalledWith('exc-1');
  });

  it('bloqueia cliente mesmo com exceção existente', async () => {
    vi.mocked(buscarExcecaoPorId).mockResolvedValue(excecao);

    await expect(excluirExcecao(usuario('cliente'), 'exc-1')).rejects.toBeInstanceOf(ForbiddenError);
  });
});