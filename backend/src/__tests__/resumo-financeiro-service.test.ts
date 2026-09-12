import { describe, it, expect, vi, beforeEach } from 'vitest';
import { obterResumoFinanceiro } from '../services/resumo-financeiro-service';
import { obterFaturamento } from '../services/agendamento-service';
import { somarReceitaPorMes, somarReceitaPorSemana } from '../repositories/agendamento-repository';
import { somarDespesasPorMes, somarDespesasPorCategoria } from '../repositories/despesa-repository';
import { exigirPermissao } from '../services/permissao-service';
import { ForbiddenError } from '../errors/ForbiddenError';
import { ValidationError } from '../errors/ValidationError';

vi.mock('../services/agendamento-service', () => ({
  obterFaturamento: vi.fn(),
}));

vi.mock('../repositories/agendamento-repository', () => ({
  somarReceitaPorMes: vi.fn(),
  somarReceitaPorSemana: vi.fn(),
}));

vi.mock('../repositories/despesa-repository', () => ({
  somarDespesasPorMes: vi.fn(),
  somarDespesasPorCategoria: vi.fn(),
}));

vi.mock('../services/permissao-service', () => ({
  exigirPermissao: vi.fn(),
}));

function usuario(role: string) {
  return { id: 'user-1', tipo: role, role };
}

function faturamento(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    inicio: '2026-01-01',
    fim: '2026-12-31',
    valorTotal: '1000.00',
    quantidade: 10,
    ticketMedio: '100.00',
    porServico: [],
    despesaTotal: '400.00',
    lucroLiquido: '600.00',
    margem: '60.00',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(exigirPermissao).mockResolvedValue(undefined);
  vi.mocked(somarReceitaPorMes).mockResolvedValue([]);
  vi.mocked(somarReceitaPorSemana).mockResolvedValue([]);
  vi.mocked(somarDespesasPorMes).mockResolvedValue([]);
  vi.mocked(somarDespesasPorCategoria).mockResolvedValue([]);
});

describe('obterResumoFinanceiro', () => {
  it('compõe KPIs do obterFaturamento e devolve todos os blocos', async () => {
    vi.mocked(obterFaturamento)
      .mockResolvedValueOnce(faturamento())
      .mockResolvedValueOnce(faturamento());

    const resumo = await obterResumoFinanceiro(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(obterFaturamento).toHaveBeenCalledTimes(2);
    expect(resumo.kpis).toEqual({
      receita: '1000.00',
      despesa: '400.00',
      lucroLiquido: '600.00',
      margem: '60.00',
    });
    // Evolução mensal: 12 meses, zeros preenchidos.
    expect(resumo.evolucaoMensal).toHaveLength(12);
    expect(resumo.evolucaoMensal.every((m) => m.receita === '0.00' && m.despesa === '0.00')).toBe(true);
    // Despesas por categoria: sempre as 4 categorias.
    expect(resumo.despesasPorCategoria).toEqual(
      ['fixa', 'variavel', 'comissao', 'outro'].map((tipo_despesa) => ({
        tipo_despesa,
        valor: '0.00',
      })),
    );
    expect(resumo.receitaRealizadaPrevista).toBeDefined();
  });

  it('assume o ano corrente quando inicio/fim não são informados', async () => {
    vi.mocked(obterFaturamento)
      .mockResolvedValueOnce(faturamento())
      .mockResolvedValueOnce(faturamento());

    const ano = new Date().getFullYear();
    const resumo = await obterResumoFinanceiro(usuario('admin'), 'admin', {});

    expect(resumo.inicio).toBe(`${ano}-01-01`);
    expect(resumo.fim).toBe(`${ano}-12-31`);
  });

  it('calcula o período anterior com mesma duração em dias', async () => {
    vi.mocked(obterFaturamento)
      .mockResolvedValueOnce(faturamento())
      .mockResolvedValueOnce(faturamento());

    const resumo = await obterResumoFinanceiro(usuario('admin'), 'admin', {
      inicio: '2026-02-10',
      fim: '2026-02-19',
    });

    // Janela de 10 dias consecutivos → anterior = [2026-01-31, 2026-02-09].
    expect(resumo.comparativoMensal.periodoAtual).toEqual({
      inicio: '2026-02-10',
      fim: '2026-02-19',
    });
    expect(resumo.comparativoMensal.periodoAnterior).toEqual({
      inicio: '2026-01-31',
      fim: '2026-02-09',
    });
  });

  it('devolve variação relativa (%) para receita/despesa/lucro e pontos percentuais para margem', async () => {
    // Atual: receita 800, despesa 200 (lucro 600, margem 75%).
    // Anterior: receita 1000, despesa 400 (lucro 600, margem 60%).
    vi.mocked(obterFaturamento)
      .mockResolvedValueOnce(
        faturamento({
          valorTotal: '800.00',
          despesaTotal: '200.00',
          lucroLiquido: '600.00',
          margem: '75.00',
        }),
      )
      .mockResolvedValueOnce(faturamento());

    const resumo = await obterResumoFinanceiro(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    // Receita: (800−1000)/1000 × 100 = −20.00%; despesa: (200−400)/400 = −50.00%;
    // lucro: (600−600)/600 = 0.00%; margem: 75−60 = +15.00 p.p.
    expect(resumo.comparativoMensal.variacaoReceitaPercentual).toBe('-20.00');
    expect(resumo.comparativoMensal.variacaoDespesaPercentual).toBe('-50.00');
    expect(resumo.comparativoMensal.variacaoLucroPercentual).toBe('0.00');
    expect(resumo.comparativoMensal.variacaoMargemPontosPercentuais).toBe('15.00');
  });

  it('devolve null quando o período anterior não tem base (zero)', async () => {
    vi.mocked(obterFaturamento)
      .mockResolvedValueOnce(faturamento())
      .mockResolvedValueOnce(
        faturamento({ valorTotal: '0', despesaTotal: '0', lucroLiquido: '0', margem: '60.00' }),
      );

    const resumo = await obterResumoFinanceiro(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(resumo.comparativoMensal.variacaoReceitaPercentual).toBeNull();
    expect(resumo.comparativoMensal.variacaoDespesaPercentual).toBeNull();
    expect(resumo.comparativoMensal.variacaoLucroPercentual).toBeNull();
    expect(resumo.comparativoMensal.variacaoMargemPontosPercentuais).toBe('0.00');
  });

  it('preenche evolução mensal a partir das linhas do repositório (últimos 12 meses)', async () => {
    vi.mocked(obterFaturamento)
      .mockResolvedValueOnce(faturamento())
      .mockResolvedValueOnce(faturamento());

    const agora = new Date();
    const mesCorrente = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    const mesAnterior = (() => {
      const d = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    // Receita: mês corrente 100.00; despesa: mês anterior 50.00.
    vi.mocked(somarReceitaPorMes).mockResolvedValue([
      { periodo: mesCorrente, valorTotal: '100.00' },
    ]);
    vi.mocked(somarDespesasPorMes).mockResolvedValue([
      { mes: mesAnterior, total: '50.00' },
    ]);

    const resumo = await obterResumoFinanceiro(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    const mCorrente = resumo.evolucaoMensal.find((m) => m.mes === mesCorrente);
    expect(mCorrente).toEqual({ mes: mesCorrente, receita: '100.00', despesa: '0.00', lucro: '100.00' });

    const mAnterior = resumo.evolucaoMensal.find((m) => m.mes === mesAnterior);
    expect(mAnterior).toEqual({ mes: mesAnterior, receita: '0.00', despesa: '50.00', lucro: '-50.00' });

    // Uma nota receita de R$0,00 → variacaoReceita não é afetada (não base do comparativo).
    expect(resumo.evolucaoMensal).toHaveLength(12);
  });

  it('devolve despesas por categoria preenchendo as 4 com zero e somando as presentes', async () => {
    vi.mocked(obterFaturamento)
      .mockResolvedValueOnce(faturamento())
      .mockResolvedValueOnce(faturamento());
    vi.mocked(somarDespesasPorCategoria).mockResolvedValue([
      { tipo_despesa: 'fixa', total: '300.00' },
      { tipo_despesa: 'comissao', total: '120.50' },
    ]);

    const resumo = await obterResumoFinanceiro(usuario('admin'), 'admin', {
      inicio: '2026-01-01',
      fim: '2026-12-31',
    });

    expect(resumo.despesasPorCategoria).toEqual([
      { tipo_despesa: 'fixa', valor: '300.00' },
      { tipo_despesa: 'variavel', valor: '0.00' },
      { tipo_despesa: 'comissao', valor: '120.50' },
      { tipo_despesa: 'outro', valor: '0.00' },
    ]);
  });

  it('devolve receita realizada × prevista por semana (segundas-feiras do período)', async () => {
    vi.mocked(obterFaturamento)
      .mockResolvedValueOnce(faturamento())
      .mockResolvedValueOnce(faturamento());

    // Período de 10 dias: 2026-02-10 (terça) → 2026-02-19 (quinta).
    // Semanas envolvidas: 2026-02-09 e 2026-02-16. Realizada e prevista com
    // valores distintos por semana, para provar que cada status é somado à parte.
    vi.mocked(somarReceitaPorSemana).mockImplementation(async ({ status }) =>
      status[0] === 'concluido'
        ? [
            { periodo: '2026-02-09', valorTotal: '80.00' },
            { periodo: '2026-02-16', valorTotal: '20.00' },
          ]
        : [
            { periodo: '2026-02-09', valorTotal: '40.00' },
            { periodo: '2026-02-16', valorTotal: '10.00' },
          ],
    );

    const resumo = await obterResumoFinanceiro(usuario('admin'), 'admin', {
      inicio: '2026-02-10',
      fim: '2026-02-19',
    });

    expect(somarReceitaPorSemana).toHaveBeenCalledWith({
      status: ['concluido'],
      inicio: '2026-02-10',
      fim: '2026-02-19',
    });
    expect(somarReceitaPorSemana).toHaveBeenCalledWith({
      status: ['pendente', 'confirmado'],
      inicio: '2026-02-10',
      fim: '2026-02-19',
    });

    expect(resumo.receitaRealizadaPrevista).toEqual([
      { semanaInicio: '2026-02-09', realizada: '80.00', prevista: '40.00' },
      { semanaInicio: '2026-02-16', realizada: '20.00', prevista: '10.00' },
    ]);
  });

  it('alimenta a prevista separadamente da realizada', async () => {
    vi.mocked(obterFaturamento)
      .mockResolvedValueOnce(faturamento())
      .mockResolvedValueOnce(faturamento());
    vi.mocked(somarReceitaPorSemana).mockImplementation(async ({ status }) =>
      status[0] === 'concluido'
        ? [{ periodo: '2026-02-09', valorTotal: '30.00' }]
        : [{ periodo: '2026-02-09', valorTotal: '170.00' }],
    );

    const resumo = await obterResumoFinanceiro(usuario('admin'), 'admin', {
      inicio: '2026-02-10',
      fim: '2026-02-19',
    });

    expect(resumo.receitaRealizadaPrevista[0]).toEqual({
      semanaInicio: '2026-02-09',
      realizada: '30.00',
      prevista: '170.00',
    });
  });

  it('bloqueia quem não tem ver_financeiro e nada é consultado', async () => {
    vi.mocked(exigirPermissao).mockRejectedValue(new ForbiddenError());

    await expect(
      obterResumoFinanceiro(usuario('recepcionista'), 'recepcionista', {
        inicio: '2026-01-01',
        fim: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(obterFaturamento).not.toHaveBeenCalled();
    expect(somarReceitaPorMes).not.toHaveBeenCalled();
    expect(somarReceitaPorSemana).not.toHaveBeenCalled();
    expect(somarDespesasPorCategoria).not.toHaveBeenCalled();
  });

  it('bloqueia cliente (todas as permissões negadas por padrão)', async () => {
    vi.mocked(exigirPermissao).mockRejectedValue(new ForbiddenError());

    await expect(
      obterResumoFinanceiro(usuario('cliente'), 'cliente', {
        inicio: '2026-01-01',
        fim: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(obterFaturamento).not.toHaveBeenCalled();
  });

  it('nega acesso quando obterFaturamento omite os campos financeiros', async () => {
    vi.mocked(obterFaturamento)
      .mockResolvedValueOnce(
        faturamento({ despesaTotal: undefined, lucroLiquido: undefined, margem: undefined }),
      )
      .mockResolvedValueOnce(faturamento());

    await expect(
      obterResumoFinanceiro(usuario('admin'), 'admin', {
        inicio: '2026-01-01',
        fim: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejeita formato de data inválido', async () => {
    await expect(
      obterResumoFinanceiro(usuario('admin'), 'admin', { inicio: '01/01/2026' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(obterFaturamento).not.toHaveBeenCalled();
  });

  it('rejeita intervalo com inicio maior que fim', async () => {
    await expect(
      obterResumoFinanceiro(usuario('admin'), 'admin', {
        inicio: '2026-12-31',
        fim: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(obterFaturamento).not.toHaveBeenCalled();
  });
});