import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('servico', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('nome').notNullable();
    table.text('descricao').nullable();
    table.integer('duracao_minutos').notNullable();
    table.decimal('preco', 10, 2).notNullable();
    table.boolean('ativo').defaultTo(true).notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('servico');
}
