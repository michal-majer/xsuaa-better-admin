import { createSecurityContext, XsuaaService } from '@sap/xssec';
import { getXsuaaConfig, isXsuaaEnabled } from './config';

export interface XsuaaUser {
  id: string;
  email?: string;
  name?: string;
  scopes: string[];
}

export async function validateXsuaaToken(token: string): Promise<XsuaaUser | null> {
  if (!isXsuaaEnabled()) {
    return null;
  }

  const xsuaaConfig = getXsuaaConfig();
  if (!xsuaaConfig) {
    throw new Error('XSUAA configuration not available');
  }

  try {
    const securityContext = await createSecurityContext(
      token,
      xsuaaConfig as unknown as XsuaaService
    );

    const givenName = securityContext.getGivenName?.() || '';
    const familyName = securityContext.getFamilyName?.() || '';
    const fullName = [givenName, familyName].filter(Boolean).join(' ') || undefined;

    return {
      id: securityContext.getLogonName(),
      email: securityContext.getEmail?.(),
      name: fullName,
      scopes: securityContext.getGrantedScopes?.() || [],
    };
  } catch (error) {
    console.error('XSUAA token validation failed:', error);
    return null;
  }
}

export function checkScope(user: XsuaaUser, scope: string): boolean {
  const xsuaaConfig = getXsuaaConfig();
  if (!xsuaaConfig) return false;

  const localScope = scope;
  const fullScope = `${xsuaaConfig.xsappname}.${scope}`;

  return user.scopes.includes(localScope) || user.scopes.includes(fullScope);
}

export function hasReadAccess(user: XsuaaUser): boolean {
  return checkScope(user, 'read');
}

export function hasWriteAccess(user: XsuaaUser): boolean {
  return checkScope(user, 'write');
}

export function hasAdminAccess(user: XsuaaUser): boolean {
  return checkScope(user, 'admin');
}
