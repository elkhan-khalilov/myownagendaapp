'use client';
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { API_HEADERS, setSyncEnabled, syncNow } from './sync';

export interface AccountStatus {
  configured: boolean;
  registered: boolean;
  authenticated: boolean;
  devices?: { id: string; name: string; createdAt: string; lastUsedAt?: string }[];
}

export class AccountError extends Error {}

const MESSAGES: Record<string, string> = {
  bad_setup_code: 'Quraşdırma kodu yanlışdır',
  unauthenticated: 'Əvvəlcə daxil olun',
  challenge_expired: 'Vaxt bitdi, yenidən cəhd edin',
  verification_failed: 'Passkey təsdiqlənmədi',
  unknown_credential: 'Bu passkey tanınmadı',
  bad_code: 'Bərpa kodu yanlışdır',
  not_registered: 'Hələ hesab yaradılmayıb',
  not_configured: 'Server ayarları tamamlanmayıb (Vercel dəyişənləri)',
  last_device: 'Sonuncu passkey silinə bilməz',
  state_changed: 'Vəziyyət dəyişib, yenidən cəhd edin',
  forbidden: 'Sorğu rədd edildi',
};

async function post<T>(path: string, body: unknown = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', headers: API_HEADERS, credentials: 'same-origin', body: JSON.stringify(body) });
  } catch {
    throw new AccountError('İnternet bağlantısı yoxdur');
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new AccountError(MESSAGES[data.error as string] ?? `Server xətası (${res.status})`);
  return data as T;
}

export async function fetchStatus(): Promise<AccountStatus | 'offline' | 'not_configured'> {
  try {
    const res = await fetch('/api/auth/status', { credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 503) return 'not_configured';
    if (!res.ok) return 'offline';
    return (await res.json()) as AccountStatus;
  } catch {
    return 'offline';
  }
}

export const passkeysSupported = () => typeof window !== 'undefined' && browserSupportsWebAuthn();

export function defaultDeviceName() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Cihaz';
}

function wrapWebAuthnError(e: unknown): never {
  const name = (e as Error)?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') throw new AccountError('Ləğv edildi');
  if (name === 'InvalidStateError') throw new AccountError('Bu cihazda passkey artıq var');
  if (e instanceof AccountError) throw e;
  throw new AccountError('Passkey əməliyyatı alınmadı');
}

/** Create a passkey. First time: `setupCode` required, returns the recovery code. */
export async function registerPasskey(opts: { setupCode?: string; deviceName: string }) {
  const optionsJSON = await post<Parameters<typeof startRegistration>[0]['optionsJSON']>('/api/auth/register-options', { setupCode: opts.setupCode });
  let response;
  try {
    response = await startRegistration({ optionsJSON });
  } catch (e) {
    wrapWebAuthnError(e);
  }
  const out = await post<{ recoveryCode?: string }>('/api/auth/register-verify', { response, deviceName: opts.deviceName });
  await setSyncEnabled(true);
  void syncNow();
  return out.recoveryCode;
}

export async function loginPasskey() {
  const optionsJSON = await post<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/api/auth/login-options');
  let response;
  try {
    response = await startAuthentication({ optionsJSON });
  } catch (e) {
    wrapWebAuthnError(e);
  }
  await post('/api/auth/login-verify', { response });
  await setSyncEnabled(true);
  return syncNow();
}

export async function loginWithRecoveryCode(code: string) {
  await post('/api/auth/recover', { code });
  await setSyncEnabled(true);
  return syncNow();
}

export async function rotateRecoveryCode() {
  return (await post<{ recoveryCode: string }>('/api/auth/recovery-reset')).recoveryCode;
}

export async function removeDevice(id: string) {
  await post('/api/auth/remove-device', { id });
}

export async function logout() {
  await post('/api/auth/logout').catch(() => undefined);
  await setSyncEnabled(false);
}
