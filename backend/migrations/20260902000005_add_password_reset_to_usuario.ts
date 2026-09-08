import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('usuario', (table) => {
    table.string('reset_token_hash').nullable();
    table.timestamp('reset_token_expires_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('usuario', (table) => {
    table.dropColumn('reset_token_expires_at');
    table.dropColumn('reset_token_hash');
  });
}
