import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE usuario
    ADD CONSTRAINT chk_usuario_tipo CHECK (tipo IN ('cliente', 'funcionario'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE usuario
    DROP CONSTRAINT IF EXISTS chk_usuario_tipo;
  `);
}
