import type { PagamentoStatus } from "../services/pagamento.js";
import { icon } from "./icons.js";

/* ------------------------------------------------------------------ */
/*  Badge de status de pagamento                                      */
/*  Segue EXATAMENTE o padrão visual de statusBadge() das views:      */
/*  `<span class="badge badge--{variant}">RÓTULO</span>` com as        */
/*  classes existentes em css/components.css.                          */
/* ------------------------------------------------------------------ */

const PAGAMENTO_LABEL: Record<PagamentoStatus, string> = {
  aprovado: "PAGAMENTO REALIZADO",
  pendente: "PAGAMENTO PENDENTE",
  recusado: "PAGAMENTO FALHOU",
  cancelado: "PAGAMENTO CANCELADO",
  expirado: "PAGAMENTO EXPIRADO",
};

const PAGAMENTO_VARIANT: Record<PagamentoStatus, string> = {
  aprovado: "success",
  pendente: "warning",
  recusado: "danger",
  cancelado: "danger",
  expirado: "danger",
};

/**
 * Gera o HTML do badge de pagamento. Quando o agendamento não possui
 * pagamento (`null`/`undefined`), devolve string vazia — o backend pode
 * omitir o campo nas listagens e isso nunca deve poluir a UI.
 */
export function pagamentoBadgeHtml(status: PagamentoStatus | null | undefined): string {
  if (!status) return "";
  return `<span class="badge badge--${PAGAMENTO_VARIANT[status]}">${PAGAMENTO_LABEL[status]}</span>`;
}

/**
 * Indicador leve da coluna "Pagamento" (Recepção e Administração): "Pago" em
 * texto na cor de sucesso do projeto (sem pílula de fundo), quando o pagamento
 * foi confirmado, e nada nos demais casos. O status detalhado
 * (pendente/recusado/cancelado/expirado) fica no selo do modal de detalhes —
 * nunca empilhado com a badge do agendamento na mesma célula.
 * Reaproveita o utilitário de texto `.text--success` e o ícone já existentes.
 */
export function pagamentoIndicadorPagoHtml(status: PagamentoStatus | null | undefined): string {
  return status === "aprovado"
    ? `<span class="text--success">${icon("check-circle", 16)} Pago</span>`
    : "";
}