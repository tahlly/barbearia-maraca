import knex from 'knex';
import knexConfig from '../knexfile';

const environment = process.env.NODE_ENV || 'development';
const connectionConfig = knexConfig[environment];

const db = knex(connectionConfig);

export default db;
