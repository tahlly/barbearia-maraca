import { describe, it, expect, vi, beforeEach } from 'vitest';
import { obterFaturamento } from '../services/agendamento-service';
import {
  resumirFaturamento,
  buscarFuncionarioPorUsuarioId,
} from '../repositories/agendamento-repository';
import type { FaturamentoResumoRow } from '../repositories/agendamento-repository';
import { ForbiddenError } from '../errors/ForbiddenError';
import { ValidationError } from '../errors/ValidationError';

vi.mock('../repositories/agendamento-repository', () => ({
  criar: vi.fn(),
  buscarPorId: vi.fn(),
  listar: vi.fn(),
  atualizarStatus: vi.fn(),
  buscarClientePorUsuarioId: vi.fn(),
  buscarFuncionarioPorUsuarioId: vi.fn(),
  funcionarioExisteAtivo: vi.fn(),
  servicoExisteAtivo: vi.fn(),
  resumirFaturamento: vi.fn(),
  buscarHorariosOcupados: vi.fn(),
}));

function usuario(role: string) {
  return { id: 'user-1', tipo: role, role };
}

const resumoVazio: FaturamentoResumoRow = {
  quantidade: 0,
  valorTotal: '0',
  porServico: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarFuncionarioPorUsuarioId).mockResolvedValue({
    id: 'func-1',
    usuario_id: 'user-1',
    ativo: true,
  });
  vi.mocked(resumirFaturamento).mockResolvedValue(resumoVazio);
});

describe('obterFaturamento', () => {
  it('bloqueia cliente', async () => {
    await expect(obterFaturamento(usuario('cliente'), 'cliente', {})).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it('bloqueia recepcionista (sem acesso financeiro)', async () => {
    await expect(obterFaturamento(usuario('recepcionista'), 'recepcionista', {})).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it('rejeita formato de data inválido', async () => {
    await expect(
      obterFaturamento(usuario('admin'), 'admin', { inicio: '01/01/2026' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejeita intervalo com inicio maior que fim', async () => {
    await expect(
      obterFaturamento(usuario('admin'), 'admin', { inicio: '2026-12-31', fim: '2026-01-01' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('profissional calcula sobre a própria agenda', async () => {
    await obterFaturamento(usuario('profissional'), 'profissional', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(resumirFaturamento).toHaveBeenCalledWith({
      funcionarioId: 'func-1',
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });
  });

  it('admin calcula sobre todos os barbeiros (sem funcionarioId)', async () => {
    await obterFaturamento(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(resumirFaturamento).toHaveBeenCalledWith({
      funcionarioId: undefined,
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });
  });

  it('assume o ano corrente quando o período não é informado', async () => {
    const anoAtual = new Date().getFullYear();

    await obterFaturamento(usuario('admin'), 'admin', {});

    expect(resumirFaturamento).toHaveBeenCalledWith({
      funcionarioId: undefined,
      inicio: `${anoAtual}-01-01`,
      fim: `${anoAtual}-12-31`,
    });
  });

  it('normaliza valores monetários e calcula ticket médio', async () => {
    vi.mocked(resumirFaturamento).mockResolvedValue({
      quantidade: 3,
      valorTotal: '45.8999999',
      porServico: [
        {
          servicoId: 'svc-1',
          servicoNome: 'Corte',
          quantidade: 2,
          valorTotal: '30.44',
        },
      ],
    });

    const resumo = await obterFaturamento(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(resumo.valorTotal).toBe('45.90');
    expect(resumo.ticketMedio).toBe('15.30');
    expect(resumo.quantidade).toBe(3);
    expect(resumo.porServico[0]).toEqual({
      servicoId: 'svc-1',
      servicoNome: 'Corte',
      quantidade: 2,
      valorTotal: '30.44',
    });
  });

  it('retorna ticket médio zerado quando não há concluídos', async () => {
    const resumo = await obterFaturamento(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(resumo.valorTotal).toBe('0.00');
    expect(resumo.quantidade).toBe(0);
    expect(resumo.ticketMedio).toBe('0.00');
    expect(resumo.porServico).toEqual([]);
  });
});