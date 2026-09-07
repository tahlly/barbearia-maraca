import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('usuario', (table) => {
    table.boolean('primeiro_acesso').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('usuario', (table) => {
    table.dropColumn('primeiro_acesso');
  });
}