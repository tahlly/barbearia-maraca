import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('horario_trabalho', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('funcionario_id').notNullable().references('id').inTable('funcionario').onDelete('CASCADE');
    table.integer('dia_semana').notNullable();
    table.time('hora_inicio').notNullable();
    table.time('hora_fim').notNullable();
    table.boolean('ativo').defaultTo(true).notNullable();
    table.timestamps(true, true);

    table.unique(['funcionario_id', 'dia_semana']);
  });

  await knex.raw(`
    ALTER TABLE horario_trabalho
    ADD CONSTRAINT chk_horario_trabalho CHECK (hora_fim > hora_inicio);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('horario_trabalho');
}
