import type { Knex } from 'knex';

/**
 * Aditivo: coluna `checkout_url` para persistir a URL de checkout devolvida
 * pelo Mercado Pago no POST /v1/orders. Permite que o reuso de um pagamento
 * pendente devolva a URL salva (antes retornava null — pendência registrada no
 * handoff da Fase 2).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pagamento', (table) => {
    table.text('checkout_url').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pagamento', (table) => {
    table.dropColumn('checkout_url');
  });
}
