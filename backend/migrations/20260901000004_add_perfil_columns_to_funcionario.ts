import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('funcionario', (table) => {
    table.string('especialidade', 100).nullable();
    table.string('foto', 255).nullable();
    table.text('descricao').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('funcionario', (table) => {
    table.dropColumn('especialidade');
    table.dropColumn('foto');
    table.dropColumn('descricao');
  });
}
