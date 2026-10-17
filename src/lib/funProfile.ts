import { FunProfileClient, SessionStorageAdapter } from '@fun-ecosystem/sso-sdk';

export const funProfile = new FunProfileClient({
  clientId: 'angel_ai_client',
  redirectUri: window.location.origin + '/auth/callback',
  scopes: ['profile', 'email', 'wallet', 'soul', 'rewards', 'platform_data'],
  storage: new SessionStorageAdapter('angel_ai_client'),
});
