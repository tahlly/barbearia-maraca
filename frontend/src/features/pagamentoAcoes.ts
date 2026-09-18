import { escapeHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { pagamentoBadgeHtml } from "../ui/pagamentoBadge.js";
import type { Appointment } from "../types.js";

/* ------------------------------------------------------------------ */
/*  Coluna "Ações" da listagem de agendamentos do cliente             */
/*  (Minha Conta). Lógica extraída como função pura para permitir     */
/*  teste unitário sem montar a SPA inteira.                          */
/*                                                                    */
/*  Regras de pagamento na linha:                                     */
/*  - pagamento aprovado → badge PAGAMENTO REALIZADO (sem PAGAR);     */
/*  - pagamento cancelado com agendamento NÃO `pendente` (ex.:        */
/*    confirmado/concluido) → badge PAGAMENTO CANCELADO (sem PAGAR);  */
/*  - pagamento cancelado com agendamento `pendente` (desistência no  */
/*    checkout) → botão PAGAR (permite nova tentativa);               */
/*  - demais casos e agendamento `pendente` → botão PAGAR (inclui     */
/*    pagamento ausente, `pendente`, `recusado` e `expirado`);        */
/*  - Reagendar e Cancelar continuam sempre disponíveis.              */
/*                                                                    */
/*  O status do agendamento e o do pagamento são estados separados:   */
/*  a coluna "Status" mostra somente o agendamento. `createPayment`   */
/*  é chamado pelo cliente dono; o backend valida a autorização real. */
/* ------------------------------------------------------------------ */

export function pagamentoAcoesHtml(
  a: Pick<Appointment, "id" | "status" | "pagamentoStatus">,
): string {
  let payArea = "";
  if (a.pagamentoStatus === "aprovado") {
    payArea = pagamentoBadgeHtml("aprovado");
  } else if (a.pagamentoStatus === "cancelado" && a.status !== "pendente") {
    payArea = pagamentoBadgeHtml("cancelado");
  } else if (a.status === "pendente") {
    payArea = `<button type="button" class="btn btn--sm btn--gold-outline" data-pay="${escapeHtml(a.id)}">${icon("credit-card", 14)} PAGAR</button>`;
  }
  return `<span class="cell-actions">
    ${payArea}
    <button type="button" class="btn btn--sm btn--ghost btn--ghost-gold" data-reschedule="${escapeHtml(a.id)}">REAGENDAR</button>
    <button type="button" class="btn btn--sm btn--danger-outline" data-cancel="${escapeHtml(a.id)}">Cancelar</button>
  </span>`;
}
