/**
 * Camada de integração do Painel do Barbeiro (Meu Painel).
 *
 * Consome `GET /api/painel-barbeiro` — endpoint único do profissional logado
 * (papel `profissional`, NUNCA exige `ver_financeiro`). Espelha os contratos
 * compartilhados em shared/types (ver AGENTS.md).
 *
 * A tela "Meu Faturamento" usa apenas `comissoesServico` (percentuais por
 * serviço do próprio profissional) para calcular a comissão do período
 * filtrado com a fórmula aprovada: (valor do serviço × %) / 100.
 */

import { httpJson } from "./api.js";

/** Percentual de comissão configurado para o próprio profissional. */
export interface PainelBarbeiroComissaoServicoDTO {
  servicoId: string;
  servicoNome: string;
  /** Percentual 0..100, string decimal normalizada (ex.: "40.00"). */
  percentual: string;
}

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
  comissoesServico: PainelBarbeiroComissaoServicoDTO[];
  atendimentosPorDia: PainelBarbeiroAtendimentoDiaDTO[];
  servicosMaisFeitos: PainelBarbeiroServicoDTO[];
  horariosMaisConcorridos: PainelBarbeiroHorarioDTO[];
}

/** Busca o Painel do Barbeiro do profissional autenticado. */
export async function obterPainelBarbeiro(): Promise<PainelBarbeiroDTO> {
  return httpJson<PainelBarbeiroDTO>("/painel-barbeiro");
}