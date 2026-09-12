// DTOs do domínio de Regras de Comissão (spec 3.4/3.5).
// Espelham os contratos compartilhados em shared/types (ver AGENTS.md).
// `percentual` na RESPOSTA é string decimal normalizada (ex.: "40.00"), mesmo
// padrão do módulo financeiro (valores monetários/percentuais como string).

export interface ConfiguracaoComissaoDTO {
  /** Interruptor global (spec 3.4): true → comissão entra no lucro. */
  comissao_ativa: boolean;
}

export interface RequestAtualizarConfiguracaoComissao {
  comissao_ativa: boolean;
}

export interface ComissaoServicoDTO {
  servico_id: string;
  servico_nome: string;
  /** Percentual 0..100, string decimal normalizada (ex.: "40.00"). */
  percentual: string;
}

/** Item da lista enviada no PUT (percentual numérico, validado na service). */
export interface ItemComissaoServicoInput {
  servico_id: string;
  percentual: number;
}

export interface RequestSalvarComissoesFuncionario {
  comissoes: ItemComissaoServicoInput[];
}

export type ResponseListarComissoesFuncionario = ComissaoServicoDTO[];