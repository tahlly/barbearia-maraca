import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('funcionario', (table) => {
    table.index('cargo', 'idx_funcionario_cargo');
  });
  await knex.schema.alterTable('horario_excecao', (table) => {
    table.index(['funcionario_id', 'data'], 'idx_horario_excecao_funcionario_data');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('funcionario', (table) => {
    table.dropIndex('cargo', 'idx_funcionario_cargo');
  });
  await knex.schema.alterTable('horario_excecao', (table) => {
    table.dropIndex(['funcionario_id', 'data'], 'idx_horario_excecao_funcionario_data');
  });
}
