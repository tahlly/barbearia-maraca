import './env';

/**
 * Configuração do Mercado Pago (experimento Checkout Pro / Orders API).
 *
 * As credenciais vivem exclusivamente no `.env` da raiz do repositório
 * (MERCADOPAGO_ACCESS_TOKEN e MERCADOPAGO_WEBHOOK_SECRET). NUNCA exportar com
 * prefixo `VITE_` — nada disso pode chegar ao navegador.
 *
 * Fail-fast SOMENTE quando a variável é usada (chamada da função): o boot do
 * servidor não falha por falta de credencial de pagamento — apenas os fluxos
 * que realmente tocam o Mercado Pago exigem a configuração.
 */
function exigirVariavel(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim() === '') {
    throw new Error(
      `[config/mercadopago] ${nome} é obrigatório para operações do Mercado Pago. ` +
        'Defina a variável no .env da raiz do repositório (sem prefixo VITE_) antes de usar este fluxo.',
    );
  }
  return valor;
}

/** Access token privado da aplicação (POST/GET /v1/orders). */
export function exigirAccessToken(): string {
  return exigirVariavel('MERCADOPAGO_ACCESS_TOKEN');
}

/** Segredo usado para validar a assinatura HMAC-SHA256 do webhook (x-signature). */
export function exigirWebhookSecret(): string {
  return exigirVariavel('MERCADOPAGO_WEBHOOK_SECRET');
}