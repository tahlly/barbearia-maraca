/**
 * Contrato HTTP público de pagamento (Mercado Pago / Orders API).
 * Espelha o enum `status_pagamento` da tabela `pagamento`.
 */
export type PagamentoStatus = 'pendente' | 'aprovado' | 'recusado' | 'cancelado' | 'expirado';

export interface PagamentoDTO {
  id: string;
  agendamentoId: string;
  status: PagamentoStatus;
  /** Valor do serviço em centavos (copiado do preço na criação do pagamento). */
  valorCentavos: number;
  /**
   * Id da ordem no Mercado Pago (mercadopago_order_id). `null` quando o
   * pagamento é PRESENCIAL (forma `presencial` não possui ordem MP — coluna
   * NULLABLE desde a migration 20260913000003).
   */
  mercadopagoOrderId: string | null;
  /** Id do pagamento aprovado no Mercado Pago (mercadopago_payment_id). */
  mercadopagoPaymentId: string | null;
  /**
   * URL do Checkout Pro devolvida pelo MP no POST /v1/orders e persistida em
   * `pagamento.checkout_url`. `null` quando a criação da ordem não devolveu
   * URL ou o pagamento ainda é antigo (coluna aditiva).
   */
  checkoutUrl: string | null;
  criadoEm?: string;
  atualizadoEm?: string;
}