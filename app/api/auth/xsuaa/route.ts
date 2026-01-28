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
    return NextResponse.redirect(`${getAppUrl()}/login?error=xsuaa_not_configured`);
  }

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  if (action === 'login') {
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
      const redirectUri = `${getAppUrl()}/api/auth/xsuaa?action=callback`;

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
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', await tokenResponse.text());
        return NextResponse.redirect(`${getAppUrl()}/login?error=token_exchange_failed`);
      }

      const tokens = await tokenResponse.json();

      // Decode the ID token to get user info
      const idToken = tokens.id_token;
      const payload = JSON.parse(
        Buffer.from(idToken.split('.')[1], 'base64').toString()
      );

      const xsuaaSubject = payload.sub || payload.user_id;
      const email = payload.email || `${xsuaaSubject}@sap.xsuaa`;
      const name = payload.given_name
        ? `${payload.given_name} ${payload.family_name}`.trim()
        : payload.user_name || email.split('@')[0];

      // Find or create user by xsuaaSubject
      let user = await db
        .select()
        .from(users)
        .where(eq(users.xsuaaSubject, xsuaaSubject))
        .limit(1)
        .then(rows => rows[0]);

      if (!user) {
        // Check if user with same email exists (link accounts)
        const existingByEmail = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1)
          .then(rows => rows[0]);

        if (existingByEmail) {
          // Link XSUAA to existing user
          await db
            .update(users)
            .set({ xsuaaSubject })
            .where(eq(users.id, existingByEmail.id));
          user = { ...existingByEmail, xsuaaSubject };
        } else {
          // Create new user
          const userId = generateId();
          const now = new Date();

          await db.insert(users).values({
            id: userId,
            email,
            name,
            emailVerified: true, // XSUAA users are verified by SAP IdP
            xsuaaSubject,
            createdAt: now,
            updatedAt: now,
          });

          // Create account record for XSUAA provider
          await db.insert(accounts).values({
            id: generateId(),
            userId,
            accountId: xsuaaSubject,
            providerId: 'xsuaa',
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            accessTokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
            createdAt: now,
            updatedAt: now,
          });

          user = {
            id: userId,
            email,
            name,
            emailVerified: true,
            xsuaaSubject,
            image: null,
            createdAt: now,
            updatedAt: now,
          };
        }
      }

      // Create session - using the same token format Better Auth expects
      // Better Auth stores the plain token and looks it up directly
      const sessionToken = generateId(32);
      const sessionId = generateId(32);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        token: sessionToken,
        expiresAt,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Redirect to dashboard with session cookie
      const response = NextResponse.redirect(`${getAppUrl()}/dashboard`);

      // Set Better Auth session cookie - the cookie name must match exactly
      response.cookies.set('better-auth.session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
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
