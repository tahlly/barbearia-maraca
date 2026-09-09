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
  pessoaAtendidaNome: string | null;
  criadoEm?: string;
}

export interface CreateAgendamentoRequest {
    funcionario_id: string;
    servico_id: string;
    data: string;
    hora: string;
    observacao?: string | null;
    // Nome da pessoa que será atendida quando o agendamento não for para o próprio cliente.
    pessoa_atendida_nome?: string | null;
    // Obrigatório quando o solicitante é recepcionista/admin (cria em nome de
    // um cliente informado); o papel cliente resolve o próprio registro via token.
    cliente_id?: string;
    // Offset do navegador em minutos relativos a UTC (ex.: -180 para UTC-3).
    // Opcional: quando ausente, o servidor assume o fuso local do processo.
    timezone_offset_minutes?: number | null;
  }
