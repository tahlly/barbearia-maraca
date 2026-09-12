// DTOs do domínio de Resumo Financeiro (seção 3.3).
// Espelham os contratos compartilhados em shared/types (ver AGENTS.md).
// Valores monetários e percentuais SEMPRE como strings decimais normalizadas.

import type { TipoDespesa } from './despesa-dto';

export interface ComparativoMensalDTO {
  periodoAtual: { inicio: string; fim: string };
  periodoAnterior: { inicio: string; fim: string };
  variacaoReceitaPercentual: string | null;
  variacaoDespesaPercentual: string | null;
  variacaoLucroPercentual: string | null;
  variacaoMargemPontosPercentuais: string | null;
}

export interface EvolucaoMensalDTO {
  mes: string;
  receita: string;
  despesa: string;
  lucro: string;
}

export interface DespesaPorCategoriaDTO {
  tipo_despesa: TipoDespesa;
  valor: string;
}

export interface ReceitaRealizadaPrevistaDTO {
  semanaInicio: string;
  realizada: string;
  prevista: string;
}

export interface ResumoFinanceiroDTO {
  inicio: string;
  fim: string;
  kpis: {
    receita: string;
    despesa: string;
    lucroLiquido: string;
    margem: string;
  };
  comparativoMensal: ComparativoMensalDTO;
  evolucaoMensal: EvolucaoMensalDTO[];
  despesasPorCategoria: DespesaPorCategoriaDTO[];
  receitaRealizadaPrevista: ReceitaRealizadaPrevistaDTO[];
}