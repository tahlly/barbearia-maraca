import type {
  ComparativoMensalDTO,
  DespesaPorCategoriaDTO,
  EvolucaoMensalDTO,
  ReceitaRealizadaPrevistaDTO,
  ResumoFinanceiroDTO,
} from '../dtos/resumo-financeiro-dto';
import type { TipoDespesa } from '../dtos/despesa-dto';
import { obterFaturamento } from './agendamento-service';
import { somarReceitaPorMes, somarReceitaPorSemana } from '../repositories/agendamento-repository';
import { somarDespesasPorCategoria, somarDespesasPorMes } from '../repositories/despesa-repository';
import { exigirPermissao } from './permissao-service';
import { validarIntervaloData } from '../utils/validadores';
import { paraCentavos, deCentavos, normalizarDecimal } from '../utils/dinheiro';
import { ForbiddenError } from '../errors/ForbiddenError';

const TIPOS_DESPESA: TipoDespesa[] = ['fixa', 'variavel', 'comissao', 'outro'];

/**
 * Resumo Financeiro da tela Financeiro › Resumo (seção 3.3).
 *
 * DECISÃO DE ESTRUTURA: endpoint único — um único `GET /api/financeiro/resumo`
 * devolve todos os blocos da tela (KPIs, comparativo, evolução mensal,
 * despesas por categoria e receita realizada vs. prevista) em uma resposta,
 * mesmo padrão dos gráficos do Dashboard (1 round-trip para a tela inteira).
 *
 * DECISÃO DE REUSO (KPIs): os KPIs são COMPOSTOS a partir de `obterFaturamento`,
 * que já anexa `despesaTotal`, `lucroLiquido` e `margem` quando o solicitante
 * possui `ver_financeiro` (que esta rota exige). NÃO chamamos
 * `obterResumoDespesas` aqui porque isso duplicaria `somarDespesasPeriodo`
 * dentro de `obterFaturamento` — a fonte única do despesa/lucro/margem é o
 * próprio faturamento (um único DTO financeiro para a tela). O período
 * anterior é obtido chamando `obterFaturamento` com a janela equivalente
 * imediatamente anterior.
 *
 * DECISÃO DE PERÍODO ANTERIOR (comparativo): janela de mesmo tamanho (em dias)
 * imediatamente anterior ao período atual: se o atual é [inicio, fim], o
 * anterior é [inicio − N dias, inicio − 1 dia], onde N = duração em dias.
 *
 * DECISÃO DE VARIAÇÃO: Receita, Despesa e Lucro usam variação RELATIVA
 * ((atual − anterior) / anterior × 100), em %, com 2 casas e sinal; quando o
 * período anterior é ZERO (sem base), devolve `null` (não há comparação).
 * A Margem usa PONTOS PERCENTUAIS (margemAtual − margemAnterior): como a
 * margem já é um percentual, expressar sua mudança como variação relativa é
 * ambíguo (ex.: 20% → 25% é "subir 25%" na leitura relativa, mas só +5 p.p. na
 * leitura financeira correta). Escolha documentada no contrato compartilhado.
 *
 * DECISÃO DE EVOLUÇÃO MENSAL: janela fixa de 12 meses terminando no mês
 * corrente — independente do `inicio`/`fim` informado (mesmo padrão do gráfico
 * de agendamentos por dia do Dashboard, que usa janela própria). Receita =
 * agendamentos concluídos; Despesa = despesas do mês; Lucro = receita − despesa.
 *
 * DECISÃO DE REALIZADA × PREVISTA: realizada = agendamentos `concluido`;
 * prevista = agendamentos `pendente` ou `confirmado` (agendados, ainda não
 * acontecidos). Agrupamento por semana de calendário (segunda-feira via
 * `date_trunc('week')`), cobrindo o período informado; as semanas que tocam o
 * período são listadas e as sem dados vêm zeradas (padrão do dashboard).
 *
 * ACESSO: permissão efetiva `ver_financeiro` no middleware E nesta service
 * (defesa em profundidade). IMPORTANTE: como o comparativo reusa
 * `obterFaturamento`, a regra existente do faturamento é herdada —
 * Recepcionista é sempre negado mesmo com override de `ver_financeiro`.
 */
export async function obterResumoFinanceiro(
  usuarioId: string,
  role: string,
  filtros: { inicio?: string; fim?: string },
): Promise<ResumoFinanceiroDTO> {
  await exigirPermissao({ id: usuarioId, role }, 'ver_financeiro');

  const anoAtual = new Date().getFullYear();
  const inicio = filtros.inicio ?? `${anoAtual}-01-01`;
  const fim = filtros.fim ?? `${anoAtual}-12-31`;
  validarIntervaloData(inicio, fim);

  const periodoAnterior = calcularPeriodoAnterior(inicio, fim);

  // Todas as consultas independentes rodam em paralelo em um único Promise.all:
  // os 3 blocos agregados novos (evolução, categorias, semanas) + o
  // faturamento do período atual e do anterior (reuso de obterFaturamento).
  const [blocos, atualFinanceiro, anteriorFinanceiro] = await Promise.all([
    carregarBlocos(inicio, fim),
    obterFaturamento(usuarioId, role, { inicio, fim }),
    obterFaturamento(usuarioId, role, { inicio: periodoAnterior.inicio, fim: periodoAnterior.fim }),
  ]);

  const atual = financeiroOuNegado(atualFinanceiro);
  const anterior = financeiroOuNegado(anteriorFinanceiro);

  const comparativoMensal: ComparativoMensalDTO = {
    periodoAtual: { inicio, fim },
    periodoAnterior,
    variacaoReceitaPercentual: variacaoPercentual(atualFinanceiro.valorTotal, anteriorFinanceiro.valorTotal),
    variacaoDespesaPercentual: variacaoPercentual(atual.despesaTotal, anterior.despesaTotal),
    variacaoLucroPercentual: variacaoPercentual(atual.lucroLiquido, anterior.lucroLiquido),
    variacaoMargemPontosPercentuais: deCentavos(paraCentavos(atual.margem) - paraCentavos(anterior.margem)),
  };

  return {
    inicio,
    fim,
    kpis: {
      receita: atualFinanceiro.valorTotal,
      despesa: atual.despesaTotal,
      lucroLiquido: atual.lucroLiquido,
      margem: atual.margem,
    },
    comparativoMensal,
    evolucaoMensal: blocos.evolucaoMensal,
    despesasPorCategoria: blocos.despesasPorCategoria,
    receitaRealizadaPrevista: blocos.receitaRealizadaPrevista,
  };
}

// ── Blocos agregados independentes ─────────────────────────────────────

async function carregarBlocos(
  inicio: string,
  fim: string,
): Promise<{
  evolucaoMensal: EvolucaoMensalDTO[];
  despesasPorCategoria: DespesaPorCategoriaDTO[];
  receitaRealizadaPrevista: ReceitaRealizadaPrevistaDTO[];
}> {
  const [receitaMensal, despesasMensais, categorias, semanaRealizada, semanaPrevista] =
    await Promise.all([
      somarReceitaPorMes({ status: ['concluido'], ...intervaloEvolucaoMensal() }),
      somarDespesasPorMes(intervaloEvolucaoMensal()),
      somarDespesasPorCategoria({ inicio, fim }),
      somarReceitaPorSemana({ status: ['concluido'], inicio, fim }),
      somarReceitaPorSemana({ status: ['pendente', 'confirmado'], inicio, fim }),
    ]);

  return {
    evolucaoMensal: montarEvolucaoMensal(receitaMensal, despesasMensais),
    despesasPorCategoria: montarDespesasPorCategoria(categorias),
    receitaRealizadaPrevista: montarReceitaRealizadaPrevista(inicio, fim, semanaRealizada, semanaPrevista),
  };
}

// ── Evolução mensal (12 meses) ────────────────────────────────────────

/** Janela própria dos últimos 12 meses, terminando no mês corrente. */
function intervaloEvolucaoMensal(): { inicio: string; fim: string } {
  const meses = listarMesesRecentes(12);
  const [anoU, mesU] = meses[meses.length - 1]!.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anoU, mesU, 0)).getUTCDate();
  return {
    inicio: `${meses[0]}-01`,
    fim: `${meses[meses.length - 1]}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

function montarEvolucaoMensal(
  receitaRows: Array<{ periodo: string; valorTotal: string | number | null }>,
  despesaRows: Array<{ mes: string; total: string | number | null }>,
): EvolucaoMensalDTO[] {
  const receitaPorMes = new Map<string, string>(
    receitaRows.map((r) => [r.periodo, normalizarDecimal(String(r.valorTotal ?? '0'))]),
  );
  const despesaPorMes = new Map<string, string>(
    despesaRows.map((r) => [r.mes, normalizarDecimal(String(r.total ?? '0'))]),
  );

  return listarMesesRecentes(12).map((mes) => {
    const receita = receitaPorMes.get(mes) ?? '0.00';
    const despesa = despesaPorMes.get(mes) ?? '0.00';
    return {
      mes,
      receita,
      despesa,
      lucro: deCentavos(paraCentavos(receita) - paraCentavos(despesa)),
    };
  });
}

// ── Despesas por categoria ────────────────────────────────────────────

function montarDespesasPorCategoria(
  rows: Array<{ tipo_despesa: TipoDespesa; total: string | number | null }>,
): DespesaPorCategoriaDTO[] {
  const porTipo = new Map<string, string>(
    rows.map((r) => [r.tipo_despesa, normalizarDecimal(String(r.total ?? '0'))]),
  );
  // SEMPRE as 4 categorias do enum (zeros preenchidos), padrão do dashboard.
  return TIPOS_DESPESA.map((tipo) => ({
    tipo_despesa: tipo,
    valor: porTipo.get(tipo) ?? '0.00',
  }));
}

// ── Receita realizada vs. prevista ────────────────────────────────────

function montarReceitaRealizadaPrevista(
  inicio: string,
  fim: string,
  realizadaRows: Array<{ periodo: string; valorTotal: string | number | null }>,
  previstaRows: Array<{ periodo: string; valorTotal: string | number | null }>,
): ReceitaRealizadaPrevistaDTO[] {
  const realizadaPorSemana = new Map<string, string>(
    realizadaRows.map((r) => [r.periodo, normalizarDecimal(String(r.valorTotal ?? '0'))]),
  );
  const previstaPorSemana = new Map<string, string>(
    previstaRows.map((r) => [r.periodo, normalizarDecimal(String(r.valorTotal ?? '0'))]),
  );

  return listarSegundasDoPeriodo(inicio, fim).map((semanaInicio) => ({
    semanaInicio,
    realizada: realizadaPorSemana.get(semanaInicio) ?? '0.00',
    prevista: previstaPorSemana.get(semanaInicio) ?? '0.00',
  }));
}

// ── Helpers de data e cálculo ─────────────────────────────────────────

/** Soma/N normaliza datas no formato YYYY-MM-DD usando UTC (evita DST). */
function deslocarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return data.toISOString().slice(0, 10);
}

/** Período anterior equivalente: mesma duração em dias, imediatamente antes. */
function calcularPeriodoAnterior(inicio: string, fim: string): { inicio: string; fim: string } {
  const duracao =
    Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000) + 1;
  const fimAnterior = deslocarDias(inicio, -1);
  const inicioAnterior = deslocarDias(fimAnterior, -(duracao - 1));
  return { inicio: inicioAnterior, fim: fimAnterior };
}

/** Últimos `quantidade` meses (YYYY-MM), terminando no mês corrente. */
function listarMesesRecentes(quantidade: number): string[] {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1; // 1–12
  const meses: string[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    let m = mes - i;
    let a = ano;
    while (m <= 0) {
      m += 12;
      a -= 1;
    }
    meses.push(`${a}-${String(m).padStart(2, '0')}`);
  }
  return meses;
}

/** Segunda-feira da semana (calendário ISO) que contém `iso`. */
function segundaDaSemana(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const diff = (data.getUTCDay() + 6) % 7; // dias desde segunda-feira
  return deslocarDias(iso, -diff);
}

/** Lista as segundas-feiras que tocam o período [inicio, fim] (inclusivo). */
function listarSegundasDoPeriodo(inicio: string, fim: string): string[] {
  const resultado: string[] = [];
  let atual = segundaDaSemana(inicio);
  const ultima = segundaDaSemana(fim);
  while (atual <= ultima) {
    resultado.push(atual);
    atual = deslocarDias(atual, 7);
  }
  return resultado;
}

/**
 * Variação relativa em % com 2 casas e sinal: ((atual − anterior) / anterior × 100).
 * Usa centavos (BigInt) para não perder precisão. `null` quando anterior = 0
 * (não há base de comparação — período sem faturamento/despesa).
 */
function variacaoPercentual(atual: string, anterior: string): string | null {
  const ant = paraCentavos(anterior);
  if (ant === 0n) {
    return null;
  }
  const diff = paraCentavos(atual) - ant;
  const milhar = (diff * 10000n) / ant; // percentual × 100 (inteiro)
  const sinal = milhar < 0n ? '-' : '';
  const abs = milhar < 0n ? -milhar : milhar;
  const inteiro = (abs / 100n).toString();
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${sinal}${inteiro}.${frac}`;
}

/**
 * `obterFaturamento` anexa `despesaTotal`/`lucroLiquido`/`margem` apenas com
 * `ver_financeiro` (que esta service já exigiu). Se por alguma razão os campos
 * vierem ausentes, nega o acesso em vez de devolver "0.00" fake (mesma regra
 * de segurança do faturamento).
 */
function financeiroOuNegado(dto: {
  despesaTotal?: string;
  lucroLiquido?: string;
  margem?: string;
}): { despesaTotal: string; lucroLiquido: string; margem: string } {
  if (dto.despesaTotal === undefined || dto.lucroLiquido === undefined || dto.margem === undefined) {
    throw new ForbiddenError('Acesso negado');
  }
  return { despesaTotal: dto.despesaTotal, lucroLiquido: dto.lucroLiquido, margem: dto.margem };
}