import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE tipo_excecao_horario AS ENUM ('bloqueio', 'liberacao');`);

  await knex.schema.createTable('horario_excecao', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('funcionario_id').notNullable().references('id').inTable('funcionario').onDelete('CASCADE');
    table.date('data').notNullable();
    table.time('hora_inicio').notNullable();
    table.time('hora_fim').notNullable();
    table.specificType('tipo', 'tipo_excecao_horario').notNullable();
    table.text('motivo').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE horario_excecao
    ADD CONSTRAINT chk_horario_excecao CHECK (hora_fim > hora_inicio);
  `);

  await knex.schema.alterTable('horario_excecao', (table) => {
    table.index(['funcionario_id', 'data'], 'idx_horario_excecao_funcionario_data');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('horario_excecao');
  await knex.raw(`DROP TYPE IF EXISTS tipo_excecao_horario;`);
}
