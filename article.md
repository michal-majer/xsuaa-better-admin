# Building Hybrid Authentication with XSUAA and PostgreSQL on SAP BTP

**Part 2 of a series** — In [Part 1](link-to-part-1), we set up PostgreSQL on SAP BTP. Now we're building a complete authentication system.

## Prerequisites

Before you start, you'll need:

- **SAP BTP Account** with Cloud Foundry enabled (Trial account works!)
- **Cloud Foundry CLI** installed (`cf`)
- **MTA Build Tool** installed (`mbt`) - `npm install -g mbt`
- **Node.js 18+**
- **Docker** (for local PostgreSQL development)

Don't have a BTP account? [Sign up for a free trial](https://www.sap.com/products/technology-platform/trial.html).

## What We're Building

In this tutorial, you'll learn how to:

- Set up **Drizzle ORM** for type-safe database access with migrations
- Implement **Better Auth** for custom user authentication stored in PostgreSQL
- Integrate **XSUAA** for platform-level security on Cloud Foundry
- Deploy a **Next.js** application to SAP BTP

The result? A production-ready authentication architecture that gives you the best of both worlds:

1. **XSUAA** controls who can access your application (platform-level)
2. **Better Auth** manages user sessions and profiles (application-level)

## Why This Architecture?

Let me explain the real-world scenario that led to this architecture:

**You have an existing product** — a Next.js application with Better Auth for user management. Users sign up with email/password, and your app stores their profiles in PostgreSQL. Your application has:
- User roles and permissions
- Foreign keys to `user_id` in other tables (orders, comments, etc.)
- Business logic tied to user records

**Now you want to deploy to SAP BTP Cloud Foundry.** Your enterprise customers expect Single Sign-On (SSO) — they don't want to create separate accounts in your app. They want to click "Sign in with SAP" and be logged in with their corporate identity.

**The challenge:** XSUAA handles SSO authentication, but your app needs users in the database. You can't just validate a token and call it a day — you need a `user_id` for foreign keys, a place to store preferences, and a session that works with your existing code.

**The solution:** XSUAA becomes an **alternative login method**, not a replacement. When a user clicks "Sign in with SAP":
1. They authenticate via SAP Identity Provider
2. Your app receives their identity from XSUAA
3. You **create or find** a user record in your database
4. You create a standard Better Auth session

The result? SAP users and email/password users end up in the same `users` table, with the same session system. Your existing code works unchanged.

## The Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | Full-stack React framework with App Router |
| **Better Auth** | Modern authentication library with TypeScript support |
| **Drizzle ORM** | Type-safe PostgreSQL access with migrations |
| **@sap/xssec** | XSUAA JWT token validation |
| **Cloud Foundry** | Deployment platform on SAP BTP |

## Part 1: Database Layer with Drizzle ORM

One of the most common questions I received after Part 1 was: "How do I handle database migrations?" Drizzle ORM provides an elegant solution.

### Setting Up Drizzle

First, install the dependencies:

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

### Defining Your Schema

Create your schema in `lib/db/schema.ts`. Better Auth requires specific tables:

```typescript
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Better Auth generates string IDs
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  // Link to XSUAA identity for hybrid auth
  xsuaaSubject: text('xsuaa_subject').unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

Notice the `xsuaaSubject` field — this lets you link Better Auth users to their XSUAA identity, enabling the hybrid approach.

### Migration Workflow

Drizzle supports two approaches:

**Development (push):** Directly sync schema to database
```bash
npm run db:push
```

**Production (migrations):** Generate and apply SQL migrations
```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate
```

The key difference? Push is fast for development, but migrations give you version-controlled database changes for production.

**Note:** The build script is configured to run `db:generate` automatically (`"build": "npm run db:generate && next build"`), so migrations are always created before deployment. The app runs these migrations on startup (`npm run db:migrate && next start`).

### Environment-Aware Database Connection

The connection needs to work both locally and on Cloud Foundry:

```typescript
// lib/env.ts
export function getDatabaseUrl(): string {
  const vcap = parseVcapServices();

  // Cloud Foundry: read from VCAP_SERVICES
  if (vcap?.['postgresql-db']?.[0]?.credentials) {
    const creds = vcap['postgresql-db'][0].credentials;
    return `postgresql://${creds.username}:${creds.password}@${creds.hostname}:${creds.port}/${creds.dbname}?sslmode=require`;
  }

  // Local: read from environment variable
  return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/xsuaa_nextjs';
}
```

**Important:** SAP BTP PostgreSQL requires SSL encryption. The `postgres` library needs explicit SSL configuration:

```typescript
// lib/db/index.ts
const isProduction = process.env.NODE_ENV === 'production';
const sslConfig = isProduction ? { rejectUnauthorized: false } : false;

const queryClient = postgres(connectionString, { ssl: sslConfig });
```

Without this, you'll get: `no pg_hba.conf entry... no encryption`

## Part 2: Better Auth Configuration

Better Auth is a modern authentication library that just works. No more wrestling with NextAuth callbacks or complex configuration.

### Server Setup

```typescript
// lib/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import * as schema from './db/schema';

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

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every 24 hours
  },
});
```

### Client Setup

```typescript
// lib/auth-client.ts
'use client';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:3000',
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

### API Route

One file handles all auth endpoints:

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { POST, GET } = toNextJsHandler(auth);
```

That's it. You now have:
- `/api/auth/sign-up` - User registration
- `/api/auth/sign-in/email` - Email/password login
- `/api/auth/sign-out` - Sign out
- `/api/auth/session` - Get current session

## Part 3: XSUAA Integration

XSUAA provides the platform-level security layer. When deployed to Cloud Foundry, XSUAA ensures only authorized users can access your application.

### Security Descriptor

Create `xs-security.json`:

```json
{
  "xsappname": "xsuaa-pg-nextjs",
  "tenant-mode": "dedicated",
  "scopes": [
    { "name": "$XSAPPNAME.read", "description": "Read access" },
    { "name": "$XSAPPNAME.write", "description": "Write access" },
    { "name": "$XSAPPNAME.admin", "description": "Admin access" }
  ],
  "role-templates": [
    {
      "name": "Viewer",
      "scope-references": ["$XSAPPNAME.read"]
    },
    {
      "name": "Editor",
      "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write"]
    },
    {
      "name": "Administrator",
      "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write", "$XSAPPNAME.admin"]
    }
  ]
}
```

### Token Validation

```typescript
// lib/xsuaa/security-context.ts
import { createSecurityContext } from '@sap/xssec';
import { getXsuaaConfig, isXsuaaEnabled } from './config';

export async function validateXsuaaToken(token: string) {
  if (!isXsuaaEnabled()) return null;

  const config = getXsuaaConfig();
  if (!config) throw new Error('XSUAA not configured');

  try {
    const ctx = await createSecurityContext(token, config);
    return {
      id: ctx.getLogonName(),
      email: ctx.getEmail?.(),
      scopes: ctx.getGrantedScopes?.() || [],
    };
  } catch {
    return null;
  }
}

export function checkScope(user: XsuaaUser, scope: string): boolean {
  const config = getXsuaaConfig();
  if (!config) return false;

  const fullScope = `${config.xsappname}.${scope}`;
  return user.scopes.includes(scope) || user.scopes.includes(fullScope);
}
```

### How It All Fits Together

```
User Request
     │
     ▼
┌─────────────────────────────────────┐
│          XSUAA Layer                │
│   (Platform access control)         │
│   - JWT token validation            │
│   - Scope checking                  │
│   - Only in production (CF)         │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│        Better Auth Layer            │
│   (Application authentication)      │
│   - User sessions                   │
│   - Custom user profiles            │
│   - Works locally and in prod       │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│        PostgreSQL                   │
│   (User data storage)               │
│   - Via Drizzle ORM                 │
│   - Type-safe queries               │
└─────────────────────────────────────┘
```

## Part 4: Local Development Setup

Development should be fast. Here's the setup:

### Docker Compose for PostgreSQL

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: xsuaa_nextjs
    ports:
      - "5432:5432"
```

### Environment Variables

```env
# .env.local
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/xsuaa_nextjs
BETTER_AUTH_SECRET=your-secret-key-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3000
XSUAA_ENABLED=false
```

Note: `XSUAA_ENABLED=false` for local development. XSUAA validation only happens on Cloud Foundry.

### Start Development

```bash
# Start PostgreSQL
docker compose up -d

# Push schema
npm run db:push

# Start dev server
npm run dev
```

Open http://localhost:3000, create an account, and you're up and running.

## Part 5: Cloud Foundry Deployment

### Create Services

```bash
# Login to CF
cf login -a https://api.cf.eu10.hana.ondemand.com

# Create XSUAA instance with security descriptor
cf create-service xsuaa application xsuaa-pg-nextjs-xsuaa -c xs-security.json

# Create PostgreSQL instance
cf create-service postgresql-db trial xsuaa-pg-nextjs-postgres
```

### MTA Deployment (Recommended)

For production, I recommend using MTA (Multi-Target Application) instead of `cf push`. Key configuration points:

```yaml
# mta.yaml (key sections)
modules:
  - name: xsuaa-pg-nextjs-app
    parameters:
      memory: 512M
      disk-quota: 2G  # Next.js builds need space
      buildpack: nodejs_buildpack
      command: npm run start  # Runs db:migrate first
    properties:
      NODE_ENV: production
      XSUAA_ENABLED: "true"
    build-parameters:
      builder: npm
      build-cmds:
        - npm run build
      ignore:
        - node_modules/
        - .env*
        - .git/
        # Do NOT ignore .next/ or drizzle/ folders!
```

**Important notes:**
- Use `next.config.mjs` (not `.ts`) to avoid TypeScript dependency at runtime
- Don't ignore `.next/` - it contains the production build
- Don't ignore `drizzle/` - it contains migration files needed for `db:migrate`
- Set `disk-quota: 2G` - Next.js builds can be large
- Use `text` type for IDs in schema - Better Auth generates string IDs, not UUIDs
- SAP BTP PostgreSQL requires SSL - configure with `ssl: { rejectUnauthorized: false }`

### Deploy

```bash
# Build MTA archive
mbt build

# Deploy to Cloud Foundry
cf deploy mta_archives/xsuaa-pg-nextjs_1.0.0.mtar
```

The build script is configured to run `db:generate` automatically, so migrations are always created before deployment.

### Assign Roles

After deployment, users need role collections assigned:

1. BTP Cockpit → Subaccount → Security → Users
2. Select your user
3. Assign "xsuaa-pg-nextjs-viewer" or other roles

## Production Considerations

### Secrets Management

Don't hardcode `BETTER_AUTH_SECRET` in manifest.yml. Options:

1. **Environment variables**: Set via `cf set-env`
2. **Credential Store**: Use BTP Credential Store service
3. **User-provided service**: Create a cups for secrets

### Migration Strategy

The manifest runs migrations on every deploy:

```yaml
command: npm run db:migrate && npm run start
```

For zero-downtime deployments, consider:
- Running migrations as a separate CF task
- Using blue-green deployments

### Monitoring

Add a health endpoint:

```typescript
// app/api/health/route.ts
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      xsuaa: process.env.XSUAA_ENABLED === 'true' ? 'enabled' : 'disabled',
    });
  } catch {
    return NextResponse.json({ status: 'unhealthy' }, { status: 503 });
  }
}
```

## What's Next?

In Part 3, we'll explore:
- Linking XSUAA identities to Better Auth users
- Implementing authorization with XSUAA scopes
- Adding social login providers
- Email verification workflow

## Repository

Full source code: [GitHub Repository Link]

---

*Questions or feedback? Find me on the SAP Community or drop a comment below.*
