/**
 * Camada de integração do módulo Financeiro (Resumo e Regras de Comissão).
 *
 * Consome a API real do Backend (PR #76 / feat/modulo-financeiro-comissao):
 * - `GET /api/financeiro/resumo`                       → `ResumoFinanceiro`
 * - `GET /api/financeiro/comissao/configuracao`        → `{ comissao_ativa }`
 * - `PUT /api/financeiro/comissao/configuracao`        → `{ comissao_ativa }`
 * - `GET /api/financeiro/comissao/pendencias`          → pendências de comissão
 *
 * Os valores monetários/percentuais vêm do Backend como strings decimais
 * normalizadas ("45.90"); a conversão para `number` fica a cargo da camada de
 * exibição (formatCurrency), que também é isenta de toLowerCase — o padrão do
 * projeto: visual MAIÚSCULO via classe `uppercase`, payload em MINÚSCULAS.
 */

import { httpJson } from "./api.js";

/** Indicadores (KPIs) do período. Valores como string decimal. */
export interface KpisFinanceiro {
  receita: string;
  despesa: string;
  lucroLiquido: string;
  margem: string;
}

/** Janela de datas do período comparado (YYYY-MM-DD). */
export interface PeriodoResumo {
  inicio: string;
  fim: string;
}

export interface ComparativoMensal {
  periodoAtual: PeriodoResumo;
  periodoAnterior: PeriodoResumo;
  /** Variação RELATIVA da receita em % (`null` quando o período anterior é zero). */
  variacaoReceitaPercentual: string | null;
  variacaoDespesaPercentual: string | null;
  variacaoLucroPercentual: string | null;
  /** Diferença de margem em PONTOS PERCENTUAIS (margemAtual − margemAnterior). */
  variacaoMargemPontosPercentuais: string | null;
}

export interface EvolucaoMensal {
  mes: string;
  receita: string;
  despesa: string;
  lucro: string;
}

export interface DespesaPorCategoria {
  tipo_despesa: string;
  valor: string;
}

export interface ReceitaRealizadaPrevista {
  semanaInicio: string;
  realizada: string;
  prevista: string;
}

export interface ResumoFinanceiro {
  inicio: string;
  fim: string;
  kpis: KpisFinanceiro;
  comparativoMensal: ComparativoMensal;
  evolucaoMensal: EvolucaoMensal[];
  despesasPorCategoria: DespesaPorCategoria[];
  receitaRealizadaPrevista: ReceitaRealizadaPrevista[];
}

export interface ConfiguracaoComissao {
  comissao_ativa: boolean;
}

/**
 * Aviso de atendimento concluído SEM percentual de comissão cadastrado.
 * Espelha `ComissaoPendenciaDTO` em shared/types — o backend devolve o array
 * DIRETO (sem envelope `items`).
 */
export interface PendenciaComissao {
  id: string;
  agendamento_id: string;
  funcionario_id: string;
  funcionario_nome: string;
  servico_id: string;
  servico_nome: string;
  /** Data do agendamento (YYYY-MM-DD). */
  data: string;
  /** Nasce `false`; pendência pendente de revisão. */
  resolvido: boolean;
}

/**
 * Busca o resumo financeiro do período (ou do padrão do Backend quando
 * nenhuma janela é informada). `periodo` é opcional: hoje a tela abre com o
 * período ativo padrão do servidor.
 */
export async function obterResumoFinanceiro(opts?: {
  inicio?: string;
  fim?: string;
}): Promise<ResumoFinanceiro> {
  const params = new URLSearchParams();
  if (opts?.inicio) params.set("inicio", opts.inicio);
  if (opts?.fim) params.set("fim", opts.fim);
  const qs = params.toString();
  return httpJson<ResumoFinanceiro>(`/financeiro/resumo${qs ? `?${qs}` : ""}`);
}

/** Lê o estado global do interruptor de comissão. */
export async function obterConfiguracaoComissao(): Promise<ConfiguracaoComissao> {
  return httpJson<ConfiguracaoComissao>("/financeiro/comissao/configuracao");
}

/** Persiste o estado do interruptor de comissão (`comissao_ativa`). */
export async function atualizarConfiguracaoComissao(comissao_ativa: boolean): Promise<ConfiguracaoComissao> {
  return httpJson<ConfiguracaoComissao>("/financeiro/comissao/configuracao", {
    method: "PUT",
    body: JSON.stringify({ comissao_ativa }),
  });
}

/** Lista os atendimentos concluídos sem percentual de comissão cadastrado. */
export async function listarPendenciasComissao(): Promise<PendenciaComissao[]> {
  return httpJson<PendenciaComissao[]>("/financeiro/comissao/pendencias");
}

/* ------------------------------------------------------------------ */
/*  Comissões por serviço de um funcionário (spec 3.5).                */
/* ------------------------------------------------------------------ */

/** Percentual de comissão de um serviço para um funcionário (espelho do
 *  `ComissaoServicoDTO` em shared/types — string decimal "40.00"). */
export interface ComissaoServicoDTO {
  servico_id: string;
  servico_nome: string;
  percentual: string;
}

/** Item de payload do PUT de comissões de um funcionário (números, não
 *  strings — percentual 0..100). Espelha `ItemComissaoServicoRequest`. */
export interface ItemComissaoServicoRequest {
  servico_id: string;
  percentual: number;
}

/**
 * Lista as comissões por serviço configuradas para um funcionário
 * (`GET /api/financeiro/comissao/funcionarios/{funcionarioId}`).
 */
export async function listarComissoesFuncionario(funcionarioId: string): Promise<ComissaoServicoDTO[]> {
  return httpJson<ComissaoServicoDTO[]>("/financeiro/comissao/funcionarios/" + encodeURIComponent(funcionarioId));
}

/**
 * SALVA (REPLACE em transação) as comissões por serviço de um funcionário
 * (`PUT /api/financeiro/comissao/funcionarios/{funcionarioId}`).
 *
 * Payload em minúsculas espelha `RequestSalvarComissoesFuncionario`:
 * `{ comissoes: [{ servico_id, percentual }] }`. O backend resolve as
 * pendências daquele par e devolve a lista salva.
 */
export async function atualizarComissoesFuncionario(
  funcionarioId: string,
  comissoes: ItemComissaoServicoRequest[],
): Promise<ComissaoServicoDTO[]> {
  return httpJson<ComissaoServicoDTO[]>("/financeiro/comissao/funcionarios/" + encodeURIComponent(funcionarioId), {
    method: "PUT",
    body: JSON.stringify({ comissoes }),
  });
}
