import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('agendamento', (table) => {
    table.text('pessoa_atendida_nome').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('agendamento', (table) => {
    table.dropColumn('pessoa_atendida_nome');
  });
}
