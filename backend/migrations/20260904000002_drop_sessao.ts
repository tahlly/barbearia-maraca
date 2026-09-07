import type { Knex } from 'knex';

/**
 * Remove a tabela `sessao` criada pela migration 20260904000001_add_sessao.
 *
 * A tabela nunca foi consumida pelo código: a autenticação é JWT puro
 * (`backend/src/config/jwt.ts` + `backend/src/middlewares/authenticate.ts`),
 * e nenhum repository/controller referencia `sessao`. Como a migration original
 * já foi aplicada em alguns ambientes, não a reescrevemos (AGENTS.md proíbe
 * reescrever migrations aplicadas); criamos uma migration de drop para que
 * qualquer banco que tenha a tabela passe a não tê-la.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sessao');
}

export async function down(knex: Knex): Promise<void> {
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