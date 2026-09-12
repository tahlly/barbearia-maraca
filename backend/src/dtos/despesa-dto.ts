// DTOs do domínio de Despesas (módulo financeiro).
// Espelham os contratos compartilhados em shared/types (ver AGENTS.md).

export type TipoDespesa = 'fixa' | 'variavel' | 'comissao' | 'outro';

/** Tipo aceito na criação/edição MANUAL: `comissao` é excluída de propósito. */
export type TipoDespesaManual = Exclude<TipoDespesa, 'comissao'>;

export interface DespesaResumoDTO {
  inicio: string;
  fim: string;
  /** Soma das despesas do período, string decimal normalizada (ex.: "57.50"). */
  despesaTotal: string;
}

export interface DespesaDTO {
  id: string;
  descricao: string;
  tipo_despesa: TipoDespesa;
  /** Valor em R$, string decimal normalizada (ex.: "45.90"). */
  valor: string;
  /** Data do lançamento (YYYY-MM-DD). */
  data: string;
  /** Indica se a despesa repete todo mês. */
  recorrente: boolean;
  /** Funcionário vinculado (opcional, ex.: despesa por profissional). */
  funcionario_id: string | null;
  /**
   * `true` quando a despesa foi gerada automaticamente pelo sistema
   * (comissão criada pelo hook — requer agendamento_id preenchido).
   * Despesas manuais (POST/PUT) SEMPRE vêm com `false`.
   */
  automatica: boolean;
}

export interface CreateDespesaInput {
  descricao: string;
  tipo_despesa: TipoDespesaManual;
  valor: string;
  data: string;
  recorrente: boolean;
  funcionarioId?: string | null;
}

export interface UpdateDespesaInput {
  descricao?: string;
  tipo_despesa?: TipoDespesaManual;
  valor?: string;
  data?: string;
  recorrente?: boolean;
  funcionarioId?: string | null;
}

export interface ListarDespesasFiltros {
  inicio?: string;
  fim?: string;
  tipoDespesa?: TipoDespesa;
}
