import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE UNIQUE INDEX uq_agendamento_funcionario_data_hora
    ON agendamento (funcionario_id, data, hora)
    WHERE (status <> 'cancelado');
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS uq_agendamento_funcionario_data_hora;
  `);
}
