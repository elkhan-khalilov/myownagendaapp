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

export type StatusResult = AccountStatus | 'offline' | { notConfigured: string[] } | { error: string };

export async function fetchStatus(): Promise<StatusResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  let res: Response;
  try {
    res = await fetch('/api/auth/status', { credentials: 'same-origin', cache: 'no-store' });
  } catch (e) {
    return { error: `Şəbəkə xətası: ${(e as Error)?.name ?? 'naməlum'}` };
  }
  const text = await res.text();
  if (res.status === 503) {
    try {
      return { notConfigured: (JSON.parse(text) as { problems?: string[] }).problems ?? [] };
    } catch {
      return { notConfigured: [] };
    }
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = (JSON.parse(text) as { detail?: string }).detail ?? '';
    } catch {
      detail = /FUNCTION_INVOCATION_FAILED/.test(text) ? 'funksiya işə düşmədi' : '';
    }
    const hint: Record<string, string> = {
      github_read_401: 'GitHub tokeni etibarsızdır',
      github_read_403: 'Tokenin bu repoya icazəsi yoxdur',
      github_write_403: 'Tokenə "Contents: Read and write" icazəsi lazımdır',
      github_write_404: 'Token data reposuna yaza bilmir',
    };
    return { error: `HTTP ${res.status}${res.status === 404 ? ' — server funksiyası tapılmadı' : ''}${detail ? ` · ${hint[detail] ?? detail}` : ''}` };
  }
  try {
    return JSON.parse(text) as AccountStatus;
  } catch {
    return { error: `HTTP ${res.status} — gözlənilməz cavab (JSON deyil)` };
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
