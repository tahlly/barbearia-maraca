import type { Knex } from 'knex';

/**
 * RBAC: permissões granulares, vínculo com usuário, auditoria e token_version.
 *
 * up():
 *  1. Adiciona coluna token_version (integer, NOT NULL DEFAULT 0) em usuario.
 *  2. Cria tabela permissao (chave text PK).
 *  3. Insere 5 permissões-padrão idempotentes (INSERT ... ON CONFLICT DO NOTHING).
 *  4. Cria tabela permissao_usuario (PK composta, FKs, coluna concedida).
 *  5. Cria tabela auditoria_permissao (log imutável, FKs, CHECK, índices).
 *  6. Backfill idempotente: concede todas as 5 permissões (concedida=true)
 *     a todos os funcionários com cargo='administrador'.
 *
 * down() reverte na ordem inversa: DROP TABLEs com CASCADE e DROP COLUMN.
 */

const PERMISSOES_PADRAO = [
  { chave: 'ver_financeiro',             descricao: 'Visualizar dados financeiros' },
  { chave: 'excluir_desativar_funcionario', descricao: 'Excluir ou desativar funcionários' },
  { chave: 'criar_admin',               descricao: 'Criar novos administradores' },
  { chave: 'gerenciar_permissoes',      descricao: 'Gerenciar permissões de usuários' },
  { chave: 'editar_servicos_categorias', descricao: 'Editar serviços e categorias' },
] as const;

export async function up(knex: Knex): Promise<void> {
  // ── 1. Coluna token_version em usuario ──────────────────────────────────
  const hasTokenVersion = await knex.schema.hasColumn('usuario', 'token_version');
  if (!hasTokenVersion) {
    await knex.schema.alterTable('usuario', (table) => {
      table.integer('token_version').notNullable().defaultTo(0);
    });
  }

  // ── 2. Tabela permissao (chave text PRIMARY KEY) ───────────────────────
  const hasPermissao = await knex.schema.hasTable('permissao');
  if (!hasPermissao) {
    await knex.schema.createTable('permissao', (table) => {
      table.text('chave').primary();
      table.text('descricao').notNullable();
      table.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  // ── 3. Seed das 5 permissões-padrão (idempotente) ──────────────────────
  for (const { chave, descricao } of PERMISSOES_PADRAO) {
    await knex.raw(
      `INSERT INTO permissao (chave, descricao) VALUES (?, ?) ON CONFLICT (chave) DO NOTHING`,
      [chave, descricao],
    );
  }

  // ── 4. Tabela permissao_usuario (PK composta, FKs, concedida) ──────────
  const hasPermissaoUsuario = await knex.schema.hasTable('permissao_usuario');
  if (!hasPermissaoUsuario) {
    await knex.schema.createTable('permissao_usuario', (table) => {
      table
        .uuid('usuario_id')
        .notNullable()
        .references('id')
        .inTable('usuario')
        .onDelete('CASCADE');
      table
        .text('permissao')
        .notNullable()
        .references('chave')
        .inTable('permissao')
        .onDelete('CASCADE');
      table.boolean('concedida').notNullable().defaultTo(true);
      table
        .uuid('criado_por')
        .nullable()
        .references('id')
        .inTable('usuario')
        .onDelete('SET NULL');
      table.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.primary(['usuario_id', 'permissao']);
    });
  }

  // ── 5. Tabela auditoria_permissao (log imutável) ───────────────────────
  const hasAuditoria = await knex.schema.hasTable('auditoria_permissao');
  if (!hasAuditoria) {
    await knex.schema.createTable('auditoria_permissao', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table
        .uuid('ator_id')
        .nullable()
        .references('id')
        .inTable('usuario')
        .onDelete('SET NULL');
      table
        .specificType('acao', 'text')
        .notNullable()
        .checkIn(['GRANT', 'REVOKE']);
      table
        .uuid('alvo_id')
        .notNullable()
        .references('id')
        .inTable('usuario')
        .onDelete('CASCADE');
      table
        .text('permissao')
        .notNullable()
        .references('chave')
        .inTable('permissao')
        .onDelete('CASCADE');
      table.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // Índices para consultas de auditoria
    await knex.schema.alterTable('auditoria_permissao', (table) => {
      table.index('alvo_id', 'idx_auditoria_permissao_alvo');
      table.index('ator_id', 'idx_auditoria_permissao_ator');
    });
  }

  // ── 6. Backfill idempotente: administradores recebem todas as permissões ─
  const hasFuncionario = await knex.schema.hasTable('funcionario');
  if (hasFuncionario) {
    await knex.raw(`
      INSERT INTO permissao_usuario (usuario_id, permissao, concedida)
      SELECT DISTINCT f.usuario_id, p.chave, true
      FROM funcionario f
      CROSS JOIN permissao p
      WHERE f.cargo = 'administrador'
      ON CONFLICT (usuario_id, permissao) DO NOTHING
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Ordem inversa de criação, com CASCADE
  await knex.schema.dropTableIfExists('auditoria_permissao');
  await knex.schema.dropTableIfExists('permissao_usuario');
  await knex.schema.dropTableIfExists('permissao');

  const hasTokenVersion = await knex.schema.hasColumn('usuario', 'token_version');
  if (hasTokenVersion) {
    await knex.schema.alterTable('usuario', (table) => {
      table.dropColumn('token_version');
    });
  }
}
