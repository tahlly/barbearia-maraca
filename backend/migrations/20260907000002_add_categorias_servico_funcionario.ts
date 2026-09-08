import type { Knex } from 'knex';

// Categoria de serviço e associações N:N com serviços e funcionários.
// Ex.: um "Corte + Barba" pertence a "Cabelo" e "Barba"; um barbeiro
// pode atender várias categorias e uma categoria pode ser atendida por
// vários barbeiros.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('categoria', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('nome').notNullable().unique();
    table.boolean('ativo').defaultTo(true).notNullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('servico_categoria', (table) => {
    table.uuid('servico_id').notNullable().references('id').inTable('servico').onDelete('CASCADE');
    table.uuid('categoria_id').notNullable().references('id').inTable('categoria').onDelete('CASCADE');
    table.primary(['servico_id', 'categoria_id']);
  });

  await knex.schema.createTable('funcionario_categoria', (table) => {
    table.uuid('funcionario_id').notNullable().references('id').inTable('funcionario').onDelete('CASCADE');
    table.uuid('categoria_id').notNullable().references('id').inTable('categoria').onDelete('CASCADE');
    table.primary(['funcionario_id', 'categoria_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('funcionario_categoria');
  await knex.schema.dropTableIfExists('servico_categoria');
  await knex.schema.dropTableIfExists('categoria');
}