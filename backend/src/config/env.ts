import dotenv from 'dotenv';
import path from 'path';

export const ROOT_ENV_PATH = path.resolve(__dirname, '..', '..', '..', '.env');

dotenv.config({ path: ROOT_ENV_PATH });
