import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE cargo_funcionario AS ENUM ('barbeiro', 'recepcionista', 'administrador');`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TYPE IF EXISTS cargo_funcionario;`);
}
