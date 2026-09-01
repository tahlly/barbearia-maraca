import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const config: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'barbearia_maraca',
    },
    migrations: {
      directory: '../migrations',
      extension: 'ts',
    },
    seeds: {
      directory: '../seeds',
    },
  },

  test: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME_TEST || 'barbearia_maraca_test',
    },
    migrations: {
      directory: '../migrations',
      extension: 'ts',
    },
    seeds: {
      directory: '../seeds',
    },
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: '../migrations',
      extension: 'ts',
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
};

export default config;
