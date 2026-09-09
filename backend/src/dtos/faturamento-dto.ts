// DTO do resumo de faturamento (dashboard do profissional/admin).
// Os valores monetários vêm do banco como DECIMAL(10,2) e são expostos como
// string normalizada (ex.: "45.90") para não perder precisão — mesmo padrão
// usado em ServicoDTO.

export interface FaturamentoPorServicoDTO {
  servicoId: string;
  servicoNome: string;
  quantidade: number;
  valorTotal: string;
}

export interface FaturamentoResumoDTO {
  inicio: string;
  fim: string;
  valorTotal: string;
  quantidade: number;
  ticketMedio: string;
  porServico: FaturamentoPorServicoDTO[];
}