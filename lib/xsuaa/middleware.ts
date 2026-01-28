import { NextRequest, NextResponse } from 'next/server';
import { isXsuaaEnabled } from './config';

export async function xsuaaMiddleware(request: NextRequest): Promise<NextResponse | null> {
  if (!isXsuaaEnabled()) {
    return null;
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
  }

  try {
    const { validateXsuaaToken } = await import('./security-context');
    const user = await validateXsuaaToken(token);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-xsuaa-user-id', user.id);
    requestHeaders.set('x-xsuaa-user-email', user.email || '');
    requestHeaders.set('x-xsuaa-scopes', user.scopes.join(','));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('XSUAA middleware error:', error);
    return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
  }
}

export function getXsuaaUserFromHeaders(headers: Headers) {
  const userId = headers.get('x-xsuaa-user-id');
  const userEmail = headers.get('x-xsuaa-user-email');
  const scopes = headers.get('x-xsuaa-scopes')?.split(',').filter(Boolean) || [];

  if (!userId) {
    return null;
  }

  return {
    id: userId,
    email: userEmail || undefined,
    scopes,
  };
}
