// DTOs do domínio de Despesas (módulo financeiro).
// Espelham os contratos compartilhados em shared/types (ver AGENTS.md).

export type TipoDespesa = 'fixa' | 'variavel' | 'comissao' | 'outro';

export interface DespesaResumoDTO {
  inicio: string;
  fim: string;
  /** Soma das despesas do período, string decimal normalizada (ex.: "57.50"). */
  despesaTotal: string;
}
