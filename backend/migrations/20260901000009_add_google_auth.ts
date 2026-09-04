import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('usuario', (table) => {
    table.string('senha_hash').nullable().alter();
    table.string('google_id').nullable().unique();
    table.string('avatar_url').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('usuario', (table) => {
    table.dropColumn('avatar_url');
    table.dropColumn('google_id');
    table.string('senha_hash').notNullable().alter();
  });
}