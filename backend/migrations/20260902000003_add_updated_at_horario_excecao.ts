import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('horario_excecao', (table) => {
    table.timestamp('updated_at', { useTz: true }).nullable();
  });

  await knex.raw(`
    UPDATE horario_excecao SET updated_at = created_at WHERE updated_at IS NULL;
  `);

  await knex.schema.alterTable('horario_excecao', (table) => {
    table.timestamp('updated_at', { useTz: true }).notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('horario_excecao', (table) => {
    table.dropColumn('updated_at');
  });
}
