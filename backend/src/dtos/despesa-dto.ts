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
   * ID do agendamento que GEROU esta despesa (obrigatório e preenchido
   * somente em despesas automáticas de comissão). `null` em despesas
   * manuais. O Frontend usa este campo para montar o link "Ver atendimento".
   */
  agendamento_id: string | null;
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
  /**
   * Página 1-based; padrão 1. Página acima do total → lista vazia, sem erro.
   * Aceita `number` ou string (query string não é convertida no controller);
   * a service normaliza valores inválidos para o padrão.
   */
  page?: number | string;
  /**
   * Itens por página; padrão 20, teto máximo 100.
   * Aceita `number` ou string (query string); a service normaliza inválidos
   * para o padrão e limita o teto.
   */
  limit?: number | string;
}

/**
 * Envelope de resposta paginada de `GET /api/despesas`.
 * Espelha o contrato compartilhado `PaginatedResponse<T>` (shared/types).
 */
export interface DespesaPaginadaDTO {
  items: DespesaDTO[];
  /** Total de itens considerando APENAS os filtros aplicados. */
  total: number;
  /** Página atual devolvida (1-based). */
  page: number;
  /** Limit efetivo usado na consulta (após clamp do teto). */
  limit: number;
  /** Total de páginas = ceil(total / limit). */
  totalPages: number;
}
