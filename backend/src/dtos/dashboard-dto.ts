// DTOs do domínio de Dashboard (gráficos da seção 3.1).
// Espelham os contratos compartilhados em shared/types (ver AGENTS.md).

export type AgendamentoStatus = 'pendente' | 'confirmado' | 'cancelado' | 'concluido';

export interface DistribuicaoStatusDTO {
  pendente: number;
  confirmado: number;
  cancelado: number;
  concluido: number;
}

export interface AgendamentosDiaDTO {
  data: string;
  quantidade: number;
}

export interface AgendamentosPorDiaDTO {
  inicio: string;
  fim: string;
  dias: AgendamentosDiaDTO[];
}

export interface HorarioPicoDTO {
  hora: string;
  quantidade: number;
}

export interface ServicoMaisVendidoDTO {
  servicoId: string;
  servicoNome: string;
  quantidade: number;
}

export interface DashboardGraficosDTO {
  inicio: string;
  fim: string;
  distribuicaoStatus: DistribuicaoStatusDTO;
  agendamentosPorDia: AgendamentosPorDiaDTO;
  horariosPico: HorarioPicoDTO[];
  servicosMaisVendidos: ServicoMaisVendidoDTO[];
}