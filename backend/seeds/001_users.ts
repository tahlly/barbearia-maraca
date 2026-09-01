import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('users').del();

  await knex('users').insert([
    {
      name: 'Carlos Silva',
      email: 'carlos@barbeariamaraca.com.br',
      phone: '(11) 99999-1111',
      role: 'ADMIN',
      password_hash: '$2b$10$placeholder_hash_admin_1234567890',
      is_active: true,
    },
    {
      name: 'Ana Souza',
      email: 'ana@barbeariamaraca.com.br',
      phone: '(11) 99999-2222',
      role: 'RECEPTIONIST',
      password_hash: '$2b$10$placeholder_hash_recep_1234567890',
      is_active: true,
    },
    {
      name: 'João Pedro',
      email: 'joao@barbeariamaraca.com.br',
      phone: '(11) 99999-3333',
      role: 'BARBER',
      password_hash: '$2b$10$placeholder_hash_barb1_1234567890',
      is_active: true,
    },
    {
      name: 'Lucas Mendes',
      email: 'lucas@barbeariamaraca.com.br',
      phone: '(11) 99999-4444',
      role: 'BARBER',
      password_hash: '$2b$10$placeholder_hash_barb2_1234567890',
      is_active: true,
    },
    {
      name: 'Maria Oliveira',
      email: 'maria@email.com',
      phone: '(11) 99999-5555',
      role: 'CLIENT',
      password_hash: '$2b$10$placeholder_hash_cli1_1234567890',
      is_active: true,
    },
    {
      name: 'Pedro Santos',
      email: 'pedro@email.com',
      phone: '(11) 99999-6666',
      role: 'CLIENT',
      password_hash: '$2b$10$placeholder_hash_cli2_1234567890',
      is_active: true,
    },
  ]);
}
