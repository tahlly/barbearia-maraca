import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from '../errors/ForbiddenError';
import { ValidationError } from '../errors/ValidationError';
import type { HorarioTrabalho, FuncionarioMin } from '../dtos/horario-dto';

const listarHorariosRepoMock = vi.fn();
const buscarFuncionarioPorUsuarioIdMock = vi.fn();

vi.mock('../repositories/horario-repository', () => ({
  listarHorarios: (...args: unknown[]) => listarHorariosRepoMock(...args),
  buscarFuncionarioPorUsuarioId: (...args: unknown[]) =>
    buscarFuncionarioPorUsuarioIdMock(...args),
  buscarHorarioPorId: vi.fn(),
  buscarFuncionarioPorId: vi.fn(),
  criarHorario: vi.fn(),
  atualizarHorario: vi.fn(),
  excluirHorario: vi.fn(),
}));

vi.mock('../repositories/agendamento-repository', () => ({
  buscarHorariosOcupados: vi.fn(),
}));

const { listarHorarios, diaDaSemanaDaDataISO } = await import('../services/horario-service');

const HORARIO_PROFISSIONAL: HorarioTrabalho = {
  id: 'h1',
  funcionario_id: 'func-1',
  funcionario_nome: 'Barbeiro 1',
  dia_semana: 1,
  hora_inicio: '09:00',
  hora_fim: '18:00',
  ativo: true,
  created_at: new Date(),
  updated_at: new Date(),
};

const FUNCIONARIO_PROPRIO: FuncionarioMin = {
  id: 'func-1',
  nome: 'Barbeiro 1',
  ativo: true,
};

describe('diaDaSemanaDaDataISO', () => {
  it('mapeia a data para o dia da semana informado, sem deslocar por fuso', () => {
    // 2026-09-17 é quinta-feira; em TZ America/Sao_Paulo o parsing ingênuo
    // (new Date('YYYY-MM-DD').getDay()) retornaria 3 (quarta).
    expect(diaDaSemanaDaDataISO('2026-09-17')).toBe(4);
    // 2026-09-13 é domingo (0) e 2026-09-19 é sábado (6).
    expect(diaDaSemanaDaDataISO('2026-09-13')).toBe(0);
    expect(diaDaSemanaDaDataISO('2026-09-19')).toBe(6);
  });

  it('rejeita datas em formato inválido', () => {
    expect(() => diaDaSemanaDaDataISO('17/09/2026')).toThrow(ValidationError);
    expect(() => diaDaSemanaDaDataISO('2026-9-17')).toThrow(ValidationError);
  });

  it('rejeita datas fora do calendário', () => {
    expect(() => diaDaSemanaDaDataISO('2026-02-30')).toThrow(ValidationError);
    expect(() => diaDaSemanaDaDataISO('2026-13-01')).toThrow(ValidationError);
  });
});

describe('listarHorarios (RBAC)', () => {
  beforeEach(() => {
    listarHorariosRepoMock.mockReset();
    buscarFuncionarioPorUsuarioIdMock.mockReset();
  });

  it('nega acesso a cliente sem consultar o repositório', async () => {
    await expect(
      listarHorarios({ id: 'u-cliente', tipo: 'cliente', role: 'cliente' }, {})
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(listarHorariosRepoMock).not.toHaveBeenCalled();
  });

  it('restringe profissional à própria agenda mesmo enviando funcionario_id de outro', async () => {
    buscarFuncionarioPorUsuarioIdMock.mockResolvedValue(FUNCIONARIO_PROPRIO);
    listarHorariosRepoMock.mockResolvedValue([HORARIO_PROFISSIONAL]);

    const resultado = await listarHorarios(
      { id: 'u-profissional', tipo: 'funcionario', role: 'profissional' },
      { funcionario_id: 'func-outro' }
    );

    expect(listarHorariosRepoMock).toHaveBeenCalledWith({
      funcionarioId: 'func-1',
      diaSemana: undefined,
    });
    expect(resultado).toHaveLength(1);
  });

  it.each(['recepcionista', 'admin'])(
    'permite %s listar sem filtro, sem alterar comportamento existente',
    async (role) => {
      listarHorariosRepoMock.mockResolvedValue([HORARIO_PROFISSIONAL]);

      const resultado = await listarHorarios(
        { id: 'u-gestor', tipo: 'funcionario', role },
        {}
      );

      expect(buscarFuncionarioPorUsuarioIdMock).not.toHaveBeenCalled();
      expect(listarHorariosRepoMock).toHaveBeenCalledWith({
        funcionarioId: undefined,
        diaSemana: undefined,
      });
      expect(resultado).toHaveLength(1);
    }
  );
});
