import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'senha123';

export async function seed(knex: Knex): Promise<void> {
  await knex('services').del();
  await knex('users').del();

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  await knex('users').insert([
    {
      name: 'Carlos Silva',
      email: 'carlos@barbeariamaraca.com.br',
      phone: '(11) 99999-1111',
      role: 'ADMIN',
      password_hash: hash,
      is_active: true,
    },
    {
      name: 'Ana Souza',
      email: 'ana@barbeariamaraca.com.br',
      phone: '(11) 99999-2222',
      role: 'RECEPTIONIST',
      password_hash: hash,
      is_active: true,
    },
    {
      name: 'João Pedro',
      email: 'joao@barbeariamaraca.com.br',
      phone: '(11) 99999-3333',
      role: 'BARBER',
      password_hash: hash,
      is_active: true,
    },
    {
      name: 'Lucas Mendes',
      email: 'lucas@barbeariamaraca.com.br',
      phone: '(11) 99999-4444',
      role: 'BARBER',
      password_hash: hash,
      is_active: true,
    },
    {
      name: 'Maria Oliveira',
      email: 'maria@email.com',
      phone: '(11) 99999-5555',
      role: 'CLIENT',
      password_hash: hash,
      is_active: true,
    },
    {
      name: 'Pedro Santos',
      email: 'pedro@email.com',
      phone: '(11) 99999-6666',
      role: 'CLIENT',
      password_hash: hash,
      is_active: true,
    },
  ]);

  await knex('services').insert([
    {
      name: 'Corte',
      description: 'Corte de cabelo masculino',
      duration_minutes: 30,
      price: 45.00,
      is_active: true,
    },
    {
      name: 'Barba',
      description: 'Barba feita com navalha e toalha quente',
      duration_minutes: 20,
      price: 35.00,
      is_active: true,
    },
    {
      name: 'Corte + Barba',
      description: 'Combo de corte de cabelo e barba',
      duration_minutes: 45,
      price: 70.00,
      is_active: true,
    },
  ]);
}
