import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('funcionario', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('usuario_id').notNullable().unique().references('id').inTable('usuario').onDelete('CASCADE');
    table.string('nome').notNullable();
    table.string('telefone').nullable();
    table.specificType('cargo', 'cargo_funcionario').notNullable().defaultTo('barbeiro');
    table.string('especialidade', 100).nullable();
    table.string('foto', 255).nullable();
    table.text('descricao').nullable();
    table.boolean('ativo').defaultTo(true).notNullable();
    table.timestamps(true, true);
  });

  await knex.schema.alterTable('funcionario', (table) => {
    table.index('cargo', 'idx_funcionario_cargo');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('funcionario');
}
