import type { Knex } from 'knex';

/**
 * RBAC: adiciona a permissão `agendar_para_cliente`.
 *
 * up():
 *  1. Insere a chave `agendar_para_cliente` em permissao (idempotente).
 *  2. Backfill idempotente: concede a permissão a todos os administradores.
 *
 * down():
 *  Remove apenas a chave `agendar_para_cliente` de permissao.
 *  As CASCADEs das FKs em permissao_usuario e auditoria_permissao
 *  removem automaticamente os registros vinculados.
 */

const CHAVE = 'agendar_para_cliente';
const DESCRICAO = 'Criar, cancelar e reagendar agendamentos de clientes';

export async function up(knex: Knex): Promise<void> {
  // ── 1. Insere a permissão (idempotente) ──────────────────────────────
  await knex.raw(
    `INSERT INTO permissao (chave, descricao) VALUES (?, ?) ON CONFLICT (chave) DO NOTHING`,
    [CHAVE, DESCRICAO],
  );

  // ── 2. Backfill idempotente: administradores recebem a permissão ──────
  const hasFuncionario = await knex.schema.hasTable('funcionario');
  if (hasFuncionario) {
    await knex.raw(
      `INSERT INTO permissao_usuario (usuario_id, permissao, concedida)
       SELECT DISTINCT f.usuario_id, ?, true
       FROM funcionario f
       WHERE f.cargo = 'administrador'
       ON CONFLICT (usuario_id, permissao) DO NOTHING`,
      [CHAVE],
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove apenas esta chave; CASCADE nas FKs limpa permissao_usuario e auditoria_permissao.
  await knex.raw(`DELETE FROM permissao WHERE chave = ?`, [CHAVE]);
}
