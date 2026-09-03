import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('horario_trabalho', (table) => {
    table.index('funcionario_id', 'idx_horario_trabalho_funcionario');
  });

  await knex.raw(`
    ALTER TABLE horario_trabalho
    ADD CONSTRAINT chk_horario_trabalho_dia_semana CHECK (dia_semana BETWEEN 0 AND 6);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE horario_trabalho
    DROP CONSTRAINT IF EXISTS chk_horario_trabalho_dia_semana;
  `);

  await knex.schema.alterTable('horario_trabalho', (table) => {
    table.dropIndex('funcionario_id', 'idx_horario_trabalho_funcionario');
  });
}
