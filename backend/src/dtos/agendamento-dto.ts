// DTOs do domínio de Agendamentos.
// Espelham os contratos compartilhados em shared/types (ver AGENTS.md).

export type AgendamentoStatus = 'pendente' | 'confirmado' | 'cancelado' | 'concluido';

export interface AgendamentoDTO {
  id: string;
  clienteId: string;
  clienteNome: string | null;
  funcionarioId: string;
  funcionarioNome: string | null;
  servicoId: string;
  servicoNome: string | null;
  data: string;
  hora: string;
  status: AgendamentoStatus;
  observacao: string | null;
  criadoEm?: string;
}

export interface CreateAgendamentoRequest {
  funcionario_id: string;
  servico_id: string;
  data: string;
  hora: string;
  observacao?: string | null;
}
