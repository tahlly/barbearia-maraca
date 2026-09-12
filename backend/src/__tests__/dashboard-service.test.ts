import { describe, it, expect, vi, beforeEach } from 'vitest';
import { obterGraficosDashboard } from '../services/dashboard-service';
import {
  contarAgendamentosPorStatus,
  contarAgendamentosPorDia,
  contarAgendamentosPorHora,
} from '../repositories/dashboard-repository';
import { resumirFaturamento } from '../repositories/agendamento-repository';
import { exigirPermissao } from '../services/permissao-service';
import { ForbiddenError } from '../errors/ForbiddenError';
import { ValidationError } from '../errors/ValidationError';

vi.mock('../repositories/dashboard-repository', () => ({
  contarAgendamentosPorStatus: vi.fn(),
  contarAgendamentosPorDia: vi.fn(),
  contarAgendamentosPorHora: vi.fn(),
}));

vi.mock('../repositories/agendamento-repository', () => ({
  resumirFaturamento: vi.fn(),
}));

// O serviço valida a permissão efetiva `ver_financeiro` antes de consultar
// qualquer gráfico (defesa em profundidade, mesmo com o middleware da rota).
vi.mock('../services/permissao-service', () => ({
  exigirPermissao: vi.fn(),
}));

function usuario(role: string) {
  return { id: 'user-1', tipo: role, role };
}

const ANO = new Date().getFullYear();

beforeEach(() => {
  vi.clearAllMocks();
  // Padrão: usuário possui a permissão. Casos negativos ajustam o mock.
  vi.mocked(exigirPermissao).mockResolvedValue(undefined);
  vi.mocked(contarAgendamentosPorStatus).mockResolvedValue([]);
  vi.mocked(contarAgendamentosPorDia).mockResolvedValue([]);
  vi.mocked(contarAgendamentosPorHora).mockResolvedValue([]);
  vi.mocked(resumirFaturamento).mockResolvedValue({
    quantidade: 0,
    valorTotal: '0',
    porServico: [],
  });
});

describe('obterGraficosDashboard', () => {
  it('devolve os 4 agrupamentos com status e dias zerados quando o período está vazio', async () => {
    const graficos = await obterGraficosDashboard(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
      dias: 7,
    });

    expect(contarAgendamentosPorStatus).toHaveBeenCalledWith({
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });
    expect(contarAgendamentosPorHora).toHaveBeenCalledWith({
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });
    expect(resumirFaturamento).toHaveBeenCalledWith({
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    // Mapa de status SEMPRE com as 4 chaves.
    expect(graficos.distribuicaoStatus).toEqual({
      pendente: 0,
      confirmado: 0,
      cancelado: 0,
      concluido: 0,
    });
    expect(graficos.agendamentosPorDia.inicio).toBeDefined();
    expect(graficos.agendamentosPorDia.fim).toBeDefined();
    // Janela de 7 dias terminando em hoje (zeros preenchidos).
    expect(graficos.agendamentosPorDia.dias).toHaveLength(7);
    expect(graficos.agendamentosPorDia.dias[6].quantidade).toBe(0);
    expect(graficos.horariosPico).toEqual([]);
    expect(graficos.servicosMaisVendidos).toEqual([]);
  });

  it('assume o intervalo do ano corrente quando inicio/fim não são informados', async () => {
    const graficos = await obterGraficosDashboard(usuario('admin'), 'admin', {});

    expect(graficos.inicio).toBe(`${ANO}-01-01`);
    expect(graficos.fim).toBe(`${ANO}-12-31`);
    expect(contarAgendamentosPorStatus).toHaveBeenCalledWith({
      inicio: `${ANO}-01-01`,
      fim: `${ANO}-12-31`,
    });
  });

  it('repassa os contadores agregados e devolve status completos', async () => {
    vi.mocked(contarAgendamentosPorStatus).mockResolvedValue([
      { status: 'confirmado', quantidade: '5' },
      { status: 'concluido', quantidade: 8 },
    ]);

    const graficos = await obterGraficosDashboard(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(graficos.distribuicaoStatus).toEqual({
      pendente: 0,
      confirmado: 5,
      cancelado: 0,
      concluido: 8,
    });
  });

  it('devolve a janela de 30 dias quando dias=30', async () => {
    const graficos = await obterGraficosDashboard(usuario('admin'), 'admin', {
      dias: 30,
    });

    expect(graficos.agendamentosPorDia.dias).toHaveLength(30);
  });

  it('preenche com zero os dias da janela que não têm agendamento', async () => {
    // Data de ontem, sempre dentro da janela dos últimos 7 dias. Usa partes
    // LOCAIS (mesmo critério de formatarData no service), não toISOString.
    const agora = new Date();
    const ontem = new Date(agora);
    ontem.setDate(agora.getDate() - 1);
    const dataOntem = [
      ontem.getFullYear(),
      String(ontem.getMonth() + 1).padStart(2, '0'),
      String(ontem.getDate()).padStart(2, '0'),
    ].join('-');

    // Retorna apenas 1 dia com agendamento; os 6 restantes devem vir zerados.
    vi.mocked(contarAgendamentosPorDia).mockResolvedValue([
      { data: ontem, quantidade: '3' },
    ]);

    const graficos = await obterGraficosDashboard(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
      dias: 7,
    });

    expect(graficos.agendamentosPorDia.dias).toHaveLength(7);
    const comQuantidade = graficos.agendamentosPorDia.dias.filter((d) => d.quantidade > 0);
    expect(comQuantidade).toEqual([{ data: dataOntem, quantidade: 3 }]);
  });

  it('devolve horários de pico normalizando HH:MM a partir da coluna hora (time)', async () => {
    vi.mocked(contarAgendamentosPorHora).mockResolvedValue([
      { hora: '09:30:00', quantidade: '4' },
      { hora: '14:00:00', quantidade: 2 },
    ]);

    const graficos = await obterGraficosDashboard(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(graficos.horariosPico).toEqual([
      { hora: '09:30', quantidade: 4 },
      { hora: '14:00', quantidade: 2 },
    ]);
  });

  it('devolve serviços mais vendidos reusando resumirFaturamento, ordenados por quantidade desc', async () => {
    vi.mocked(resumirFaturamento).mockResolvedValue({
      quantidade: 9,
      valorTotal: '300.00',
      porServico: [
        { servicoId: 's1', servicoNome: 'Corte', quantidade: 5, valorTotal: '150.00' },
        { servicoId: 's2', servicoNome: 'Barba', quantidade: 4, valorTotal: '150.00' },
      ],
    });

    const graficos = await obterGraficosDashboard(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(graficos.servicosMaisVendidos).toEqual([
      { servicoId: 's1', servicoNome: 'Corte', quantidade: 5 },
      { servicoId: 's2', servicoNome: 'Barba', quantidade: 4 },
    ]);
  });

  it('bloqueia quem não tem ver_financeiro (recepcionista por padrão) e nada é consultado', async () => {
    vi.mocked(exigirPermissao).mockRejectedValue(new ForbiddenError());

    await expect(
      obterGraficosDashboard(usuario('recepcionista'), 'recepcionista', {
        inicio: '2026-01-01',
        fim: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(contarAgendamentosPorStatus).not.toHaveBeenCalled();
    expect(contarAgendamentosPorDia).not.toHaveBeenCalled();
    expect(contarAgendamentosPorHora).not.toHaveBeenCalled();
    expect(resumirFaturamento).not.toHaveBeenCalled();
  });

  it('bloqueia cliente (todas as permissões negadas por padrão)', async () => {
    vi.mocked(exigirPermissao).mockRejectedValue(new ForbiddenError());

    await expect(
      obterGraficosDashboard(usuario('cliente'), 'cliente', {
        inicio: '2026-01-01',
        fim: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(contarAgendamentosPorStatus).not.toHaveBeenCalled();
  });

  it('rejeita formato de data inválido', async () => {
    await expect(
      obterGraficosDashboard(usuario('admin'), 'admin', { inicio: '01/01/2026' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(contarAgendamentosPorStatus).not.toHaveBeenCalled();
  });

  it('rejeita intervalo com inicio maior que fim', async () => {
    await expect(
      obterGraficosDashboard(usuario('admin'), 'admin', {
        inicio: '2026-12-31',
        fim: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(contarAgendamentosPorStatus).not.toHaveBeenCalled();
  });

  it('rejeita dias diferente de 7 ou 30', async () => {
    await expect(
      obterGraficosDashboard(usuario('admin'), 'admin', { dias: 14 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(contarAgendamentosPorDia).not.toHaveBeenCalled();
  });
});