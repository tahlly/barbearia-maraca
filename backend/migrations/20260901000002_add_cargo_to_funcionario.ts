import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE funcionario
    ADD COLUMN cargo cargo_funcionario NOT NULL DEFAULT 'barbeiro';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('funcionario', (table) => {
    table.dropColumn('cargo');
  });
}
