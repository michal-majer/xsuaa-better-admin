# Step-by-Step Implementation Guide

This guide walks you through building a Next.js application with hybrid authentication (Better Auth + XSUAA SSO) on SAP BTP Cloud Foundry.

## Prerequisites

- Node.js 18+
- Docker (for local PostgreSQL)
- Cloud Foundry CLI (for deployment)
- MTA Build Tool (`npm install -g mbt`)
- SAP BTP account with Cloud Foundry enabled

## Step 1: Project Setup

### 1.1 Create Next.js Project

```bash
npx create-next-app@latest xsuaa-pg-nextjs --typescript --tailwind --eslint --app
cd xsuaa-pg-nextjs
```

### 1.2 Install Dependencies

```bash
# Core dependencies
npm install better-auth drizzle-orm postgres @sap/xsenv @sap/xssec zod tsx

# Development dependencies
npm install -D drizzle-kit
```

### 1.3 Create Directory Structure

```bash
mkdir -p lib/db lib/xsuaa scripts types
```

## Step 2: Environment Configuration

### 2.1 Create lib/env.ts

This module handles both local development (.env) and Cloud Foundry (VCAP_SERVICES) environments.

```typescript
// lib/env.ts
import { z } from 'zod';

function parseVcapServices() {
  const vcap = process.env.VCAP_SERVICES;
  if (!vcap) return null;
  try {
    return JSON.parse(vcap);
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
  // Cloud Foundry: VCAP_APPLICATION contains URLs
  const vcapApp = process.env.VCAP_APPLICATION;
  if (vcapApp) {
    const app = JSON.parse(vcapApp);
    if (app.uris?.[0]) {
      return `https://${app.uris[0]}`;
    }
  }
  return process.env.BETTER_AUTH_URL || 'http://localhost:3000';
}
```

### 2.2 Create .env.local

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/xsuaa_nextjs
BETTER_AUTH_SECRET=your-secret-key-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
XSUAA_ENABLED=false
NODE_ENV=development
```

## Step 3: Database Layer with Drizzle

### 3.1 Create Schema (lib/db/schema.ts)

**Important:** Better Auth generates string IDs, not UUIDs. Use `text` type for IDs.

```typescript
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  xsuaaSubject: text('xsuaa_subject').unique(), // Link to XSUAA identity
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### 3.2 Create Database Client (lib/db/index.ts)

**Important:** SAP BTP PostgreSQL requires SSL connections. The `postgres` library needs explicit SSL configuration.

```typescript
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
```

### 3.3 Create Migration Script (scripts/migrate.ts)

**Important:** The migration script must parse VCAP_SERVICES for CF deployment and use SSL.

```typescript
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
```

### 3.4 Configure package.json scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "npm run db:migrate && next start",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:push": "drizzle-kit push",
    "mta:build": "mbt build",
    "mta:deploy": "cf deploy mta_archives/xsuaa-pg-nextjs_1.0.0.mtar"
  }
}
```

### 3.5 Start Local PostgreSQL

```bash
docker compose up -d
npm run db:push  # For local dev - syncs schema directly
```

### 3.6 Understanding Migration Workflow

**Why two approaches?**
- `db:push` - Fast for local dev, directly syncs schema to DB (no migration files)
- `db:generate` + `db:migrate` - Safe for production, version-controlled SQL migrations

**Good news:** The build script automatically runs `db:generate`:
```json
"build": "npm run db:generate && next build"
```

So when you run `mbt build` or `npm run build`, migrations are created automatically in `drizzle/migrations/`. These files are deployed with your app and run on CF startup.

## Step 4: Better Auth Configuration

### 4.1 Server Configuration (lib/auth.ts)

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import * as schema from './db/schema';
import { env, getAppUrl } from './env';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL: getAppUrl(),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,
  },
});
```

### 4.2 Client Configuration (lib/auth-client.ts)

```typescript
'use client';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:3000',
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

### 4.3 API Route (app/api/auth/[...all]/route.ts)

```typescript
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { POST, GET } = toNextJsHandler(auth);
```

## Step 5: XSUAA SSO Integration

### 5.1 Understanding XSUAA SSO

XSUAA is NOT a separate authentication layer - it's an **alternative login method**. When users click "Sign in with SAP":

1. They're redirected to SAP IdP (Identity Provider)
2. After authentication, they're redirected back with an authorization code
3. We exchange the code for tokens
4. We **create or find** a user in our PostgreSQL database
5. We create a Better Auth session for that user

Both login methods (email/password and XSUAA) result in the same session type stored in PostgreSQL.

### 5.2 XSUAA OAuth Route (app/api/auth/xsuaa/route.ts)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getXsuaaCredentials, getAppUrl } from '@/lib/env';
import { db } from '@/lib/db';
import { users, sessions, accounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

function generateId(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

export async function GET(request: NextRequest) {
  const xsuaa = getXsuaaCredentials();

  if (!xsuaa) {
    // Not available locally - only works on Cloud Foundry
    return NextResponse.redirect(`${getAppUrl()}/login?error=xsuaa_not_configured`);
  }

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  if (action === 'login') {
    // Redirect to SAP IdP
    const redirectUri = `${getAppUrl()}/api/auth/xsuaa?action=callback`;
    const authUrl = new URL('/oauth/authorize', xsuaa.url);
    authUrl.searchParams.set('client_id', xsuaa.clientid);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid');
    return NextResponse.redirect(authUrl.toString());
  }

  if (action === 'callback') {
    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.redirect(`${getAppUrl()}/login?error=no_code`);
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch(`${xsuaa.url}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${xsuaa.clientid}:${xsuaa.clientsecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${getAppUrl()}/api/auth/xsuaa?action=callback`,
        }),
      });

      if (!tokenResponse.ok) {
        return NextResponse.redirect(`${getAppUrl()}/login?error=token_exchange_failed`);
      }

      const tokens = await tokenResponse.json();

      // Decode ID token to get user info
      const payload = JSON.parse(
        Buffer.from(tokens.id_token.split('.')[1], 'base64').toString()
      );

      const xsuaaSubject = payload.sub || payload.user_id;
      const email = payload.email || `${xsuaaSubject}@sap.xsuaa`;
      const name = payload.given_name
        ? `${payload.given_name} ${payload.family_name}`.trim()
        : payload.user_name || email.split('@')[0];

      // Find or create user
      let user = await db.select().from(users)
        .where(eq(users.xsuaaSubject, xsuaaSubject))
        .limit(1)
        .then(rows => rows[0]);

      if (!user) {
        // Check if user with same email exists (link accounts)
        const existingByEmail = await db.select().from(users)
          .where(eq(users.email, email))
          .limit(1)
          .then(rows => rows[0]);

        if (existingByEmail) {
          // Link XSUAA to existing user
          await db.update(users)
            .set({ xsuaaSubject })
            .where(eq(users.id, existingByEmail.id));
          user = { ...existingByEmail, xsuaaSubject };
        } else {
          // Create new user (auto-provisioning)
          const userId = generateId();
          await db.insert(users).values({
            id: userId,
            email,
            name,
            emailVerified: true,
            xsuaaSubject,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Create account record
          await db.insert(accounts).values({
            id: generateId(),
            userId,
            accountId: xsuaaSubject,
            providerId: 'xsuaa',
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            accessTokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          user = { id: userId, email, name, emailVerified: true, xsuaaSubject, image: null, createdAt: new Date(), updatedAt: new Date() };
        }
      }

      // Create Better Auth session
      const sessionToken = generateId(64);
      await db.insert(sessions).values({
        id: generateId(),
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Set session cookie and redirect
      const response = NextResponse.redirect(`${getAppUrl()}/dashboard`);
      response.cookies.set('better-auth.session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        path: '/',
      });

      return response;
    } catch (error) {
      console.error('XSUAA callback error:', error);
      return NextResponse.redirect(`${getAppUrl()}/login?error=callback_failed`);
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
```

### 5.3 Security Descriptor (xs-security.json)

```json
{
  "xsappname": "xsuaa-pg-nextjs",
  "tenant-mode": "dedicated",
  "oauth2-configuration": {
    "redirect-uris": [
      "https://*.cfapps.eu10.hana.ondemand.com/api/auth/xsuaa"
    ]
  },
  "scopes": [
    { "name": "$XSAPPNAME.read", "description": "Read access" },
    { "name": "$XSAPPNAME.write", "description": "Write access" }
  ],
  "role-templates": [
    { "name": "Viewer", "scope-references": ["$XSAPPNAME.read"] },
    { "name": "Editor", "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write"] }
  ]
}
```

## Step 6: Login Page with SAP Button

### 6.1 Update Login Page

Add the "Sign in with SAP" button to your login form:

```typescript
// In your login form component
<a
  href="/api/auth/xsuaa?action=login"
  className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-gray-300 rounded-md"
>
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#0070F2"/>
    <path d="M2 17L12 22L22 17" stroke="#0070F2" strokeWidth="2"/>
    <path d="M2 12L12 17L22 12" stroke="#0070F2" strokeWidth="2"/>
  </svg>
  Sign in with SAP
</a>
```

**Note:** This button only works on Cloud Foundry. Locally, it shows an error message.

## Step 7: Middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/', '/login', '/signup', '/api/auth', '/api/health'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.some(
    route => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check Better Auth session (works for both email/password and XSUAA login)
  const sessionCookie = request.cookies.get('better-auth.session_token');

  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
```

## Step 8: Local Testing

```bash
# Start PostgreSQL
docker compose up -d

# Push schema
npm run db:push

# Start dev server
npm run dev
```

1. Open http://localhost:3000
2. Click "Create Account" and register
3. Verify you're redirected to /dashboard
4. Test sign out

**Note:** "Sign in with SAP" won't work locally - that's expected.

## Step 9: Cloud Foundry Deployment with MTA

### 9.1 Create mta.yaml

**Important:**
- Use `disk-quota: 2G` - Next.js builds can be large
- Don't ignore `.next/` folder - it contains the production build
- Use `next.config.mjs` (JavaScript) instead of `next.config.ts` to avoid TypeScript dependency at runtime

```yaml
_schema-version: "3.1"
ID: xsuaa-pg-nextjs
version: 1.0.0
description: Next.js app with XSUAA and PostgreSQL

parameters:
  enable-parallel-deployments: true

modules:
  - name: xsuaa-pg-nextjs-app
    type: nodejs
    path: .
    parameters:
      memory: 512M
      disk-quota: 2G  # Important: Next.js needs more space
      buildpack: nodejs_buildpack
      command: npm run start
    properties:
      NODE_ENV: production
      XSUAA_ENABLED: "true"
      BETTER_AUTH_SECRET: "{{generate-secure-secret}}"
    build-parameters:
      builder: npm
      build-cmds:
        - npm run build  # Build Next.js before packaging
      ignore:
        - node_modules/
        - .env*
        - .git/
        - "*.md"
        - docker-compose.yml
        - mta_archives/
        # Note: Do NOT ignore .next/ or drizzle/
    requires:
      - name: xsuaa-pg-nextjs-xsuaa
      - name: psql-dev  # or your PostgreSQL service name

resources:
  - name: xsuaa-pg-nextjs-xsuaa
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: xs-security.json

  - name: psql-dev
    type: org.cloudfoundry.existing-service
```

### 9.2 Create next.config.mjs

**Important:** Use `.mjs` extension (not `.ts`) to avoid TypeScript dependency at runtime:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

### 9.2 Create .npmrc (Reduce Package Size)

Create `.npmrc` to skip devDependencies on CF:

```
omit=dev
```

### 9.3 Build and Deploy

```bash
# Remove old artifacts
rm -rf node_modules mta_archives .next

# Build MTA archive (automatically runs db:generate via npm build)
mbt build

# Deploy to Cloud Foundry
cf deploy mta_archives/xsuaa-pg-nextjs_1.0.0.mtar
```

**Note:** The build script (`npm run build`) automatically generates migrations before building Next.js, so you don't need to run `db:generate` manually.

### 9.3 Verify Deployment

```bash
# Check app status
cf app xsuaa-pg-nextjs-app

# View logs
cf logs xsuaa-pg-nextjs-app --recent
```

## Troubleshooting

### "SAP login is only available when deployed to Cloud Foundry"

This is expected locally. XSUAA credentials come from `VCAP_SERVICES` which is only available on CF.

### Database connection fails

- Check PostgreSQL is running: `docker ps`
- Verify DATABASE_URL in .env.local

### "no pg_hba.conf entry... no encryption"

SAP BTP PostgreSQL requires SSL. Ensure your database client has SSL enabled:

```typescript
const sslConfig = isProduction ? { rejectUnauthorized: false } : false;
const client = postgres(connectionString, { ssl: sslConfig });
```

### MTA build fails with ENOTEMPTY

```bash
rm -rf node_modules mta_archives .xsuaa-pg-nextjs_mta_build_tmp
mbt build
```

### "Can't find meta/_journal.json file"

Migrations not generated or not included in MTA. Check:
1. Run `npm run db:generate` to create migrations
2. Ensure `drizzle/` is NOT in mta.yaml ignore list

### "Failed to transpile next.config.ts"

Use `next.config.mjs` (JavaScript) instead of `next.config.ts`. TypeScript config requires TypeScript at runtime which isn't installed in production:

```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

### Better Auth UUID error

Make sure schema uses `text` for IDs, not `uuid`. Better Auth generates string IDs.

### "No space left on device" during deployment

1. Add `.npmrc` with `omit=dev` to skip devDependencies
2. Increase `disk-quota` to 2G in mta.yaml
3. Ensure `node_modules/` is in ignore list

### "Could not find a production build"

The `.next/` folder is missing. Either:
1. Don't ignore `.next/` in mta.yaml
2. Add `build-cmds: ["npm run build"]` to build-parameters

## Summary

You now have:

- **Better Auth** for email/password authentication
- **XSUAA SSO** for SAP users (auto-provisions users to DB)
- **Drizzle ORM** for type-safe database access
- **MTA deployment** to Cloud Foundry

Both login methods create users in the same `users` table and use the same session system.
