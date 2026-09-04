import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sessao', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('usuario_id').notNullable().references('id').inTable('usuario').onDelete('CASCADE');
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('criada_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('expira_em', { useTz: true }).notNullable();
    table.timestamp('revogada_em', { useTz: true }).nullable();
  });

  await knex.schema.alterTable('sessao', (table) => {
    table.index('usuario_id', 'idx_sessao_usuario_id');
  });

  await knex.raw(`
    ALTER TABLE sessao
    ADD CONSTRAINT chk_sessao_expira_apos_criacao CHECK (expira_em > criada_em);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sessao');
}
