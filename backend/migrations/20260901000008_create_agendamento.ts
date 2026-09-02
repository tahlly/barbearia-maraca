import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE status_agendamento AS ENUM ('pendente', 'confirmado', 'cancelado', 'concluido');`);

  await knex.schema.createTable('agendamento', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('cliente_id').notNullable().references('id').inTable('cliente').onDelete('CASCADE');
    table.uuid('funcionario_id').notNullable().references('id').inTable('funcionario').onDelete('CASCADE');
    table.uuid('servico_id').notNullable().references('id').inTable('servico').onDelete('CASCADE');
    table.date('data').notNullable();
    table.time('hora').notNullable();
    table.specificType('status', 'status_agendamento').notNullable().defaultTo('pendente');
    table.text('observacao').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.alterTable('agendamento', (table) => {
    table.index(['funcionario_id', 'data', 'hora'], 'idx_agendamento_funcionario_data');
    table.index(['cliente_id', 'data'], 'idx_agendamento_cliente_data');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('agendamento');
  await knex.raw(`DROP TYPE IF EXISTS status_agendamento;`);
}
