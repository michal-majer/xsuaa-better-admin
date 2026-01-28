import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

function getConnectionString(): string {
  // Parse VCAP_SERVICES for Cloud Foundry
  const vcapServices = process.env.VCAP_SERVICES;
  if (vcapServices) {
    try {
      const services = JSON.parse(vcapServices);
      const pgService = services['postgresql-db']?.[0];
      if (pgService?.credentials) {
        const creds = pgService.credentials;
        return `postgresql://${creds.username}:${creds.password}@${creds.hostname}:${creds.port}/${creds.dbname}`;
      }
    } catch (e) {
      console.error('Failed to parse VCAP_SERVICES:', e);
    }
  }

  return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/xsuaa_nextjs';
}

async function runMigrations() {
  console.log('Running migrations...');

  const connectionString = getConnectionString();
  const isProduction = process.env.NODE_ENV === 'production';
  const sslConfig = isProduction ? { rejectUnauthorized: false } : false;

  console.log(`Connecting to database (SSL: ${isProduction ? 'enabled' : 'disabled'})...`);

  const migrationClient = postgres(connectionString, { max: 1, ssl: sslConfig });
  const db = drizzle(migrationClient);

  try {
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  await migrationClient.end();
  process.exit(0);
}

runMigrations();
