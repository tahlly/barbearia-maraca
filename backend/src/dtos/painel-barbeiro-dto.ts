// DTOs do domínio Painel do Barbeiro (Meu Painel).
// Espelham os contratos compartilhados em shared/types (ver AGENTS.md).

export interface PainelBarbeiroComissaoDTO {
  valorAtual: string;
  mesAnterior: string;
  variacaoPercentual: string | null;
}

export interface PainelBarbeiroAtendimentoDiaDTO {
  data: string;
  quantidade: number;
}

export interface PainelBarbeiroServicoDTO {
  servicoId: string;
  servicoNome: string;
  quantidade: number;
}

export interface PainelBarbeiroHorarioDTO {
  hora: string;
  quantidade: number;
}

export interface PainelBarbeiroDTO {
  atendimentosMes: number;
  comissaoMes: PainelBarbeiroComissaoDTO | null;
  atendimentosPorDia: PainelBarbeiroAtendimentoDiaDTO[];
  servicosMaisFeitos: PainelBarbeiroServicoDTO[];
  horariosMaisConcorridos: PainelBarbeiroHorarioDTO[];
}