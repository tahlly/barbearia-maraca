import type { PagamentoStatus } from "../services/pagamento.js";
import type { UserRole } from "../types.js";

/**
 * Decisão pura de UX da tela de agendamentos (Recepcionista): ao concluir um
 * atendimento, pergunta "O cliente pagou?" somente quando NÃO há pagamento
 * aprovado no agendamento (presencial ou Mercado Pago). A resposta "Sim" envia
 * `registrar_pagamento_presencial: true` ao contrato de conclusão.
 *
 * - `recepcionista` + status ≠ `aprovado` (inclui `null`/`undefined`, que o
 *   backend usa quando o agendamento nunca teve pagamento) → pergunta.
 * - `recepcionista` + `aprovado` → não pergunta: não existe dupla cobrança e o
 *   backend recusaria a flag com erro de validação.
 * - Qualquer outro papel (`admin`/`profissional`/`cliente`) → não pergunta: a
 *   recepção é a única que opera pagamento presencial no balcão; os demais
 *   seguem exatamente o fluxo de conclusão atual.
 */
export function devePerguntarPagamentoPresencial(
  role: UserRole,
  pagamentoStatus: PagamentoStatus | null | undefined,
): boolean {
  return role === "recepcionista" && pagamentoStatus !== "aprovado";
}

/**
 * Opções do diálogo "O cliente pagou?" (fluxo da Recepção ao concluir um
 * atendimento sem pagamento aprovado). O diálogo é BLOQUEANTE
 * (`blocking: true`): a única saída é Sim ou Não, porque fechar por X, ESC ou
 * clique no fundo equivaleria a "Não" — concluir o atendimento SEM registrar o
 * pagamento — um caminho que a usuária decidiu remover. Não existe terceiro
 * estado: quem abre este diálogo tem que responder.
 */
export interface OpcoesDialogoPagamentoPresencial {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  blocking: true;
}

export function opcoesDialogoPagamentoPresencial(): OpcoesDialogoPagamentoPresencial {
  return {
    title: "O cliente pagou?",
    message:
      "Se o cliente pagou no balcão (dinheiro ou maquininha), o pagamento será registrado como pago junto da conclusão.",
    confirmLabel: "Sim",
    cancelLabel: "Não",
    blocking: true,
  };
}