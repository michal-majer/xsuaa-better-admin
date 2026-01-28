import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { getDatabaseUrl } from '../env';

const connectionString = getDatabaseUrl();

// Enable SSL for Cloud Foundry PostgreSQL
const isProduction = process.env.NODE_ENV === 'production';
const sslConfig = isProduction ? { rejectUnauthorized: false } : false;

const queryClient = postgres(connectionString, { ssl: sslConfig });
export const db = drizzle(queryClient, { schema });

export function createMigrationClient() {
  const migrationClient = postgres(connectionString, { max: 1, ssl: sslConfig });
  return drizzle(migrationClient, { schema });
}
