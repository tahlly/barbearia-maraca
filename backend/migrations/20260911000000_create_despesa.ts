import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE tipo_despesa AS ENUM ('fixa', 'variavel', 'comissao', 'outro');`);

  await knex.schema.createTable('despesa', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('descricao', 255).notNullable();
    table.specificType('tipo_despesa', 'tipo_despesa').notNullable().defaultTo('outro');
    table.decimal('valor', 10, 2).notNullable();
    table.date('data').notNullable();
    table.boolean('recorrente').notNullable().defaultTo(false);
    table.uuid('funcionario_id').nullable().references('id').inTable('funcionario').onDelete('SET NULL');
    table.uuid('agendamento_id').nullable().references('id').inTable('agendamento').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  await knex.schema.alterTable('despesa', (table) => {
    table.index(['data'], 'idx_despesa_data');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('despesa');
  await knex.raw('DROP TYPE IF EXISTS tipo_despesa;');
}
