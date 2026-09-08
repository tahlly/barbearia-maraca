import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('servico', (table) => {
    table.string('categoria', 80).nullable();
  });

  await knex.schema.alterTable('funcionario', (table) => {
    table.string('categoria', 80).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('funcionario', (table) => {
    table.dropColumn('categoria');
  });

  await knex.schema.alterTable('servico', (table) => {
    table.dropColumn('categoria');
  });
}