declare module '@sap/xsenv' {
  export function loadEnv(): void;
  export function getServices<T extends Record<string, { tag?: string; label?: string; name?: string }>>(
    query: T
  ): { [K in keyof T]: unknown };
}

declare module '@sap/xssec' {
  export interface XsuaaService {
    xsappname: string;
    clientid: string;
    clientsecret: string;
    url: string;
    uaadomain: string;
    verificationkey: string;
    identityzone: string;
    zoneid: string;
  }

  export interface SecurityContext {
    getLogonName(): string;
    getEmail?(): string | undefined;
    getGivenName?(): string | undefined;
    getFamilyName?(): string | undefined;
    getGrantedScopes?(): string[] | undefined;
  }

  export function createSecurityContext(
    token: string,
    config: XsuaaService
  ): Promise<SecurityContext>;
}
