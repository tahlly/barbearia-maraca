import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('email').notNullable().unique();
    table.string('phone').nullable();
    table.enum('role', ['CLIENT', 'BARBER', 'RECEPTIONIST', 'ADMIN']).defaultTo('CLIENT').notNullable();
    table.string('password_hash').notNullable();
    table.boolean('is_active').defaultTo(true).notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('users');
}
