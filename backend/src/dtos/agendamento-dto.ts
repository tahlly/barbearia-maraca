// DTOs do domínio de Agendamentos.
// Espelham os contratos compartilhados em shared/types (ver AGENTS.md).

import type { PagamentoStatus } from './pagamento-dto';

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
  /**
   * Status do pagamento mais recente do agendamento (aditivo do experimento de
   * pagamento). Presente apenas nas respostas de listar/obter agendamento;
   * ausente no JSON nos demais fluxos (criar/cancelar/confirmar/concluir).
   * null quando não existe pagamento.
   */
  pagamentoStatus?: PagamentoStatus | null;
}

export interface CreateAgendamentoRequest {
    funcionario_id: string;
    servico_id: string;
    data: string;
    hora: string;
    observacao?: string | null;
    // Obrigatório quando o solicitante é recepcionista/admin (cria em nome de
    // um cliente informado); o papel cliente resolve o próprio registro via token.
    cliente_id?: string;
    // Offset do navegador em minutos relativos a UTC (ex.: -180 para UTC-3).
    // Opcional: quando ausente, o servidor assume o fuso local do processo.
    timezone_offset_minutes?: number | null;
  }
