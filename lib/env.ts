import { z } from 'zod';

interface VcapServices {
  'postgresql-db'?: Array<{
    credentials: {
      hostname: string;
      port: string;
      dbname: string;
      username: string;
      password: string;
      uri: string;
      sslcert?: string;
      sslrootcert?: string;
    };
  }>;
  xsuaa?: Array<{
    credentials: {
      clientid: string;
      clientsecret: string;
      url: string;
      uaadomain: string;
      verificationkey: string;
      xsappname: string;
      identityzone: string;
      zoneid: string;
    };
  }>;
}

interface VcapApplication {
  uris?: string[];
  application_name?: string;
}

function parseVcapServices(): VcapServices | null {
  const vcap = process.env.VCAP_SERVICES;
  if (!vcap) return null;

  try {
    return JSON.parse(vcap) as VcapServices;
  } catch {
    return null;
  }
}

function parseVcapApplication(): VcapApplication | null {
  const vcap = process.env.VCAP_APPLICATION;
  if (!vcap) return null;

  try {
    return JSON.parse(vcap) as VcapApplication;
  } catch {
    return null;
  }
}

export function getDatabaseUrl(): string {
  const vcap = parseVcapServices();

  if (vcap?.['postgresql-db']?.[0]?.credentials) {
    const creds = vcap['postgresql-db'][0].credentials;
    return `postgresql://${creds.username}:${creds.password}@${creds.hostname}:${creds.port}/${creds.dbname}?sslmode=require`;
  }

  return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/xsuaa_nextjs';
}

export function getXsuaaCredentials() {
  const vcap = parseVcapServices();

  if (vcap?.xsuaa?.[0]?.credentials) {
    return vcap.xsuaa[0].credentials;
  }

  return null;
}

export function getAppUrl(): string {
  const vcapApp = parseVcapApplication();

  if (vcapApp?.uris?.[0]) {
    return `https://${vcapApp.uris[0]}`;
  }

  return process.env.BETTER_AUTH_URL || 'http://localhost:3000';
}

export function isXsuaaEnabled(): boolean {
  return process.env.XSUAA_ENABLED === 'true' && getXsuaaCredentials() !== null;
}

const envSchema = z.object({
  DATABASE_URL: z.string(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  XSUAA_ENABLED: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().default(false)
  ),
});

function createEnv() {
  const databaseUrl = getDatabaseUrl();
  const appUrl = getAppUrl();

  const rawEnv = {
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'development-secret-key-minimum-32-characters-long',
    BETTER_AUTH_URL: appUrl,
    NODE_ENV: process.env.NODE_ENV || 'development',
    XSUAA_ENABLED: process.env.XSUAA_ENABLED === 'true',
  };

  if (process.env.NODE_ENV === 'production') {
    return envSchema.parse(rawEnv);
  }

  return envSchema.safeParse(rawEnv).data || rawEnv;
}

export const env = createEnv() as z.infer<typeof envSchema>;
