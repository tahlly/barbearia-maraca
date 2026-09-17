import { describe, it, expect, vi, beforeEach } from 'vitest';
import { obterPainelBarbeiro } from '../services/painel-barbeiro-service';
import {
  contarAgendamentosPorDia,
  contarAgendamentosPorHora,
} from '../repositories/dashboard-repository';
import { resumirFaturamento } from '../repositories/agendamento-repository';
import {
  buscarConfiguracaoComissao,
  listarComissoesDoFuncionario,
} from '../repositories/comissao-repository';
import { somarComissaoFuncionarioPeriodo } from '../repositories/despesa-repository';
import { buscarFuncionarioPorUsuarioId } from '../repositories/horario-repository';
import { ForbiddenError } from '../errors/ForbiddenError';

vi.mock('../repositories/dashboard-repository', () => ({
  contarAgendamentosPorDia: vi.fn(),
  contarAgendamentosPorHora: vi.fn(),
}));

vi.mock('../repositories/agendamento-repository', () => ({
  resumirFaturamento: vi.fn(),
}));

vi.mock('../repositories/comissao-repository', () => ({
  buscarConfiguracaoComissao: vi.fn(),
  listarComissoesDoFuncionario: vi.fn(),
}));

vi.mock('../repositories/despesa-repository', () => ({
  somarComissaoFuncionarioPeriodo: vi.fn(),
}));

vi.mock('../repositories/horario-repository', () => ({
  buscarFuncionarioPorUsuarioId: vi.fn(),
}));

const FUNCIONARIO = { id: 'func-1', nome: 'João', ativo: true };

function usuario(role: string) {
  return { id: 'user-1', tipo: role, role };
}

function formatarDataLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Primeiro e último dia do mês civil deslocado por `offset`. */
function intervaloMes(offset: number): { inicio: string; fim: string } {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1 + offset;
  const [anoFinal, mesFinal] =
    mes <= 0 ? [ano - 1, mes + 12] : mes > 12 ? [ano + 1, mes - 12] : [ano, mes];
  const ultimoDia = new Date(Date.UTC(anoFinal, mesFinal, 0)).getUTCDate();
  return {
    inicio: `${anoFinal}-${String(mesFinal).padStart(2, '0')}-01`,
    fim: `${anoFinal}-${String(mesFinal).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

const MES_CORRENTE = intervaloMes(0);
const MES_ANTERIOR = intervaloMes(-1);

function hoje(): string {
  return formatarDataLocal(new Date());
}

/** Janela dos últimos 7 dias (mesmo cálculo do service). */
function janela7(): { inicio: string; dias: string[] } {
  const dias: string[] = [];
  const hojeDate = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hojeDate);
    d.setDate(hojeDate.getDate() - i);
    dias.push(formatarDataLocal(d));
  }
  return { inicio: dias[0], dias };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarFuncionarioPorUsuarioId).mockResolvedValue(FUNCIONARIO);
  vi.mocked(resumirFaturamento).mockResolvedValue({
    quantidade: 0,
    valorTotal: '0',
    porServico: [],
  });
  vi.mocked(contarAgendamentosPorDia).mockResolvedValue([]);
  vi.mocked(contarAgendamentosPorHora).mockResolvedValue([]);
  vi.mocked(buscarConfiguracaoComissao).mockResolvedValue(false);
  vi.mocked(somarComissaoFuncionarioPeriodo).mockResolvedValue('0');
  vi.mocked(listarComissoesDoFuncionario).mockResolvedValue([]);
});

describe('obterPainelBarbeiro', () => {
  it('bloqueia papel diferente de profissional ANTES de tocar qualquer repositório', async () => {
    for (const role of ['cliente', 'recepcionista', 'admin']) {
      await expect(obterPainelBarbeiro(usuario(role).id, role)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    }
    expect(buscarFuncionarioPorUsuarioId).not.toHaveBeenCalled();
    expect(resumirFaturamento).not.toHaveBeenCalled();
    expect(buscarConfiguracaoComissao).not.toHaveBeenCalled();
  });

  it('bloqueia usuário autenticado sem vínculo com funcionário', async () => {
    vi.mocked(buscarFuncionarioPorUsuarioId).mockResolvedValue(null);

    await expect(obterPainelBarbeiro('user-1', 'profissional')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(resumirFaturamento).not.toHaveBeenCalled();
  });

  it('resolve o profissional pelo usuário logado e repassa funcionarioId a todas as consultas', async () => {
    await obterPainelBarbeiro('user-1', 'profissional');

    expect(buscarFuncionarioPorUsuarioId).toHaveBeenCalledWith('user-1');
    expect(resumirFaturamento).toHaveBeenCalledWith({
      funcionarioId: 'func-1',
      inicio: MES_CORRENTE.inicio,
      fim: MES_CORRENTE.fim,
    });
    expect(contarAgendamentosPorHora).toHaveBeenCalledWith({
      funcionarioId: 'func-1',
      inicio: MES_CORRENTE.inicio,
      fim: MES_CORRENTE.fim,
    });
    expect(contarAgendamentosPorDia).toHaveBeenCalledWith(
      expect.objectContaining({ funcionarioId: 'func-1' }),
    );
  });

  it('devolve painel completo com comissão ativa (comparativo mês anterior)', async () => {
    vi.mocked(buscarConfiguracaoComissao).mockResolvedValue(true);
    vi.mocked(resumirFaturamento).mockResolvedValue({
      quantidade: 12,
      valorTotal: '180.00',
      porServico: [
        { servicoId: 's1', servicoNome: 'Corte', quantidade: 8, valorTotal: '120.00' },
        { servicoId: 's2', servicoNome: 'Barba', quantidade: 4, valorTotal: '60.00' },
      ],
    });
    vi.mocked(contarAgendamentosPorHora).mockResolvedValue([
      { hora: '09:30:00', quantidade: '5' },
      { hora: '14:00:00', quantidade: '2' },
    ]);
    vi.mocked(somarComissaoFuncionarioPeriodo)
      .mockResolvedValueOnce('142.50')
      .mockResolvedValueOnce('130.00');
    vi.mocked(listarComissoesDoFuncionario).mockResolvedValue([
      { servico_id: 's1', servico_nome: 'Corte', percentual: '10' },
      { servico_id: 's2', servico_nome: 'Barba', percentual: '15' },
    ]);

    const painel = await obterPainelBarbeiro('user-1', 'profissional');

    expect(painel.atendimentosMes).toBe(12);
    // Mesmo padrão de precisão do resumo financeiro: 2 casas TRUNCADAS
    // (não arredondadas) — (142.50−130.00)/130.00×100 = 9.615… → "9.61".
    expect(painel.comissaoMes).toEqual({
      valorAtual: '142.50',
      mesAnterior: '130.00',
      variacaoPercentual: '9.61',
    });
    // Serviços ordenados por quantidade decrescente.
    expect(painel.servicosMaisFeitos).toEqual([
      { servicoId: 's1', servicoNome: 'Corte', quantidade: 8 },
      { servicoId: 's2', servicoNome: 'Barba', quantidade: 4 },
    ]);
    expect(painel.horariosMaisConcorridos).toEqual([
      { hora: '09:30', quantidade: 5 },
      { hora: '14:00', quantidade: 2 },
    ]);
    // Percentuais por serviço do próprio profissional (espelho do catálogo).
    expect(painel.comissoesServico).toEqual([
      { servicoId: 's1', servicoNome: 'Corte', percentual: '10' },
      { servicoId: 's2', servicoNome: 'Barba', percentual: '15' },
    ]);
    // Comparativo usa o mês civil anterior.
    expect(somarComissaoFuncionarioPeriodo).toHaveBeenNthCalledWith(1, {
      funcionarioId: 'func-1',
      inicio: MES_CORRENTE.inicio,
      fim: MES_CORRENTE.fim,
    });
    expect(somarComissaoFuncionarioPeriodo).toHaveBeenNthCalledWith(2, {
      funcionarioId: 'func-1',
      inicio: MES_ANTERIOR.inicio,
      fim: MES_ANTERIOR.fim,
    });
  });

  it('devolve comissaoMes null e NÃO consulta somas quando o interruptor está desligado', async () => {
    vi.mocked(buscarConfiguracaoComissao).mockResolvedValue(false);

    const painel = await obterPainelBarbeiro('user-1', 'profissional');

    expect(painel.comissaoMes).toBeNull();
    expect(somarComissaoFuncionarioPeriodo).not.toHaveBeenCalled();
  });

  it('devolve variacaoPercentual null quando o mês anterior é zero (sem base)', async () => {
    vi.mocked(buscarConfiguracaoComissao).mockResolvedValue(true);
    vi.mocked(somarComissaoFuncionarioPeriodo)
      .mockResolvedValueOnce('50.00')
      .mockResolvedValueOnce('0');

    const painel = await obterPainelBarbeiro('user-1', 'profissional');

    expect(painel.comissaoMes).toEqual({
      valorAtual: '50.00',
      mesAnterior: '0.00',
      variacaoPercentual: null,
    });
  });

  it('preenche os 7 dias da janela com zeros quando não há atendimentos', async () => {
    const janela = janela7();

    const painel = await obterPainelBarbeiro('user-1', 'profissional');

    expect(painel.atendimentosPorDia).toHaveLength(7);
    expect(painel.atendimentosPorDia[0].data).toBe(janela.inicio);
    expect(painel.atendimentosPorDia[6].data).toBe(hoje());
    expect(painel.atendimentosPorDia.every((d) => d.quantidade === 0)).toBe(true);
  });

  it('distribui as quantidades do dia no dia correspondente da janela', async () => {
    const janela = janela7();
    vi.mocked(contarAgendamentosPorDia).mockResolvedValue([
      { data: janela.dias[3], quantidade: '3' },
      { data: janela.dias[6], quantidade: 1 },
    ]);

    const painel = await obterPainelBarbeiro('user-1', 'profissional');

    expect(painel.atendimentosPorDia).toHaveLength(7);
    expect(painel.atendimentosPorDia[3]).toEqual({ data: janela.dias[3], quantidade: 3 });
    expect(painel.atendimentosPorDia[6]).toEqual({ data: janela.dias[6], quantidade: 1 });
    expect(painel.atendimentosPorDia[0].quantidade).toBe(0);
  });
});