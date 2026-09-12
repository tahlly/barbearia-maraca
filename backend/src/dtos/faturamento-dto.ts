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
  // DECISÃO DE SEGURANÇA: estes 3 campos financeiros só podem existir na
  // resposta quando o solicitante possui a permissão efetiva `ver_financeiro`
  // (admin tem por padrão; profissional NÃO; overrides no banco contam).
  // Portanto são OPCIONAIS por tipagem e a service OMITE de verdade os campos
  // para quem não tem a permissão — nunca retorna "0.00" fake.
  // despesaTotal = soma das despesas do período (string decimal normalizada);
  // lucroLiquido = valorTotal − despesaTotal;
  // margem = (lucro / valorTotal) × 100 (percentual, 2 casas; "0.00" se 0).
  despesaTotal?: string;
  lucroLiquido?: string;
  margem?: string;
}