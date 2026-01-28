import xsenv from '@sap/xsenv';

export interface XsuaaCredentials {
  clientid: string;
  clientsecret: string;
  url: string;
  uaadomain: string;
  verificationkey: string;
  xsappname: string;
  identityzone: string;
  zoneid: string;
}

let cachedCredentials: XsuaaCredentials | null = null;

export function getXsuaaConfig(): XsuaaCredentials | null {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  try {
    xsenv.loadEnv();

    const services = xsenv.getServices({
      xsuaa: { tag: 'xsuaa' },
    });

    if (services.xsuaa) {
      cachedCredentials = services.xsuaa as XsuaaCredentials;
      return cachedCredentials;
    }

    return null;
  } catch (error) {
    console.warn('XSUAA service not bound:', error);
    return null;
  }
}

export function isXsuaaEnabled(): boolean {
  return process.env.XSUAA_ENABLED === 'true' && getXsuaaConfig() !== null;
}
