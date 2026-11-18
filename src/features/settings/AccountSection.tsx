'use client';
import { Cloud, CloudOff, Copy, Fingerprint, KeyRound, LogOut, RefreshCw, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Field, Input } from '@/components/ui/controls';
import {
  AccountError, defaultDeviceName, fetchStatus, loginPasskey, loginWithRecoveryCode, logout, passkeysSupported, registerPasskey, removeDevice,
  rotateRecoveryCode, type StatusResult,
} from '@/services/account';
import { syncNow } from '@/services/sync';
import { confirmAction, useUI } from '@/stores/ui';
import { useSyncStore } from '@/stores/sync';
import { formatDayMonth, toKey } from '@/utils/date';
import { haptic } from '@/utils/haptics';

const time = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return toKey(d) === toKey(new Date()) ? `bu gün ${hm}` : `${formatDayMonth(toKey(d))}, ${hm}`;
};

export function AccountSection() {
  const showToast = useUI((s) => s.showToast);
  const sync = useSyncStore();
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [setupCode, setSetupCode] = useState('');
  const [deviceName, setDeviceName] = useState(defaultDeviceName());
  const [recoveryInput, setRecoveryInput] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  const refresh = useCallback(async () => setStatus(await fetchStatus()), []);
  useEffect(() => {
    void refresh();
  }, [refresh, sync.enabled]);

  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await fn();
      if (success) {
        haptic('success');
        showToast({ message: success });
      }
      await refresh();
    } catch (e) {
      showToast({ message: e instanceof AccountError ? e.message : 'Xəta baş verdi', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  if (status === null) return <div className="h-24 animate-pulse rounded-2xl bg-soft" aria-busy="true" />;

  if (status === 'offline')
    return (
      <Box icon={<CloudOff size={20} className="text-muted" />} title="Bulud sinxronizasiyası">
        <p className="text-[13.5px] text-muted">Hesab vəziyyətini yoxlamaq üçün internet lazımdır.</p>
        <Button variant="soft" className="mt-3 h-10 w-full" onClick={() => void refresh()}>Yenidən yoxla</Button>
      </Box>
    );

  if (typeof status === 'object' && 'error' in status)
    return (
      <Box icon={<CloudOff size={20} className="text-expense" />} title="Server cavab vermədi">
        <p className="text-[13.5px] text-muted">
          Sinxronizasiya serveri xəta qaytardı: <b className="text-ink">{status.error}</b>
        </p>
        <Button variant="soft" className="mt-3 h-10 w-full" onClick={() => void refresh()}>Yenidən yoxla</Button>
      </Box>
    );

  if (status === 'not_configured')
    return (
      <Box icon={<CloudOff size={20} className="text-muted" />} title="Bulud sinxronizasiyası">
        <p className="text-[13.5px] text-muted">Server ayarları tamamlanmayıb: Vercel-də GITHUB_TOKEN, DATA_REPO və SESSION_SECRET dəyişənlərini yoxlayın.</p>
      </Box>
    );

  if (!passkeysSupported())
    return (
      <Box icon={<CloudOff size={20} className="text-muted" />} title="Bulud sinxronizasiyası">
        <p className="text-[13.5px] text-muted">Bu brauzer passkey dəstəkləmir. iPhone-da Safari və ya Ana ekran tətbiqindən istifadə edin.</p>
      </Box>
    );

  // ---------- not registered: first-time setup ----------
  if (!status.registered)
    return (
      <Box icon={<Cloud size={20} className="text-primary dark:text-accent" />} title="GitHub sinxronizasiyasını qur">
        <p className="mb-3 text-[13.5px] text-muted">
          Məlumatlar şəxsi (private) GitHub reponuzda saxlanacaq və cihazlar arasında sinxronlaşacaq. Giriş Face ID (passkey) ilədir.
        </p>
        <div className="space-y-3">
          <Field label="Quraşdırma kodu" hint="Yalnız ilk dəfə lazımdır">
            <Input value={setupCode} onChange={(e) => setSetupCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="one-time-code" maxLength={20} />
          </Field>
          <Field label="Cihazın adı">
            <Input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} maxLength={40} />
          </Field>
          <Button
            className="w-full"
            disabled={busy || setupCode.replace(/\W/g, '').length < 12}
            onClick={() =>
              run(async () => {
                const code = await registerPasskey({ setupCode, deviceName });
                if (code) setNewCode(code);
              }, 'Hesab yaradıldı, sinxronizasiya aktivdir')
            }
          >
            <Fingerprint size={18} /> Face ID ilə hesab yarat
          </Button>
        </div>
        {newCode && <RecoveryCodeDialog code={newCode} onClose={() => setNewCode(null)} />}
      </Box>
    );

  // ---------- registered, this device signed out ----------
  if (!status.authenticated)
    return (
      <Box icon={<Cloud size={20} className="text-primary dark:text-accent" />} title="Bulud sinxronizasiyası">
        <p className="mb-3 text-[13.5px] text-muted">Bu cihazda daxil olun: məlumatlar GitHub-dakı nüsxə ilə birləşdiriləcək.</p>
        <Button className="w-full" disabled={busy} onClick={() => run(loginPasskey, 'Daxil oldunuz, sinxronlaşdırılır')}>
          <Fingerprint size={18} /> Face ID ilə daxil ol
        </Button>
        {!showRecovery ? (
          <button className="mt-3 w-full text-center text-[13px] font-medium text-primary dark:text-accent" onClick={() => setShowRecovery(true)}>
            Bu cihazda passkey yoxdur? Bərpa kodu ilə daxil ol
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <Input value={recoveryInput} onChange={(e) => setRecoveryInput(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autoCapitalize="characters" maxLength={40} />
            <Button
              variant="soft"
              className="w-full"
              disabled={busy || recoveryInput.replace(/\W/g, '').length < 20}
              onClick={() => run(() => loginWithRecoveryCode(recoveryInput), 'Daxil oldunuz — indi bu cihaz üçün passkey əlavə edin')}
            >
              <KeyRound size={18} /> Bərpa kodu ilə daxil ol
            </Button>
          </div>
        )}
      </Box>
    );

  // ---------- signed in ----------
  const phaseLabel: Record<string, string> = {
    idle: `Son sinxronizasiya: ${time(sync.lastSyncAt)}`,
    syncing: 'Sinxronlaşdırılır…',
    offline: 'Oflayn — internet olanda sinxronlaşacaq',
    error: `Xəta: ${sync.error ?? 'naməlum'}`,
    signed_out: 'Sessiya bitib — yenidən daxil olun',
    not_configured: 'Server ayarları tamamlanmayıb',
    disabled: 'Bu cihazda sinxronizasiya söndürülüb',
  };

  return (
    <Box icon={<ShieldCheck size={20} className="text-income" />} title="Bulud sinxronizasiyası aktivdir">
      <p className="text-[13.5px] text-muted" aria-live="polite">{phaseLabel[sync.phase] ?? ''}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="soft" className="h-11 text-[14px]" disabled={sync.phase === 'syncing'} onClick={() => run(async () => {
          const r = await syncNow();
          if (r !== 'ok') throw new AccountError(r === 'offline' ? 'İnternet yoxdur' : 'Sinxronizasiya alınmadı');
        }, 'Sinxronlaşdırıldı')}>
          <RefreshCw size={16} className={sync.phase === 'syncing' ? 'animate-spin' : ''} /> İndi
        </Button>
        <Button variant="soft" className="h-11 text-[14px]" disabled={busy} onClick={() => run(() => registerPasskey({ deviceName }), 'Passkey əlavə edildi')}>
          <Fingerprint size={16} /> Passkey əlavə et
        </Button>
      </div>

      {status.devices && status.devices.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12.5px] font-medium text-muted">Passkey-lər</p>
          <ul className="space-y-1.5">
            {status.devices.map((d) => (
              <li key={d.id} className="flex items-center gap-2.5 rounded-xl bg-card px-3 py-2 text-[14px]">
                <Smartphone size={16} className="text-muted" />
                <span className="flex-1">
                  {d.name}
                  <span className="block text-[11.5px] text-muted">Son istifadə: {time(d.lastUsedAt ?? d.createdAt)}</span>
                </span>
                {status.devices!.length > 1 && (
                  <button
                    aria-label={`${d.name} passkey-ni sil`}
                    className="grid h-8 w-8 place-items-center rounded-full text-expense"
                    onClick={async () => {
                      if (await confirmAction({ title: `"${d.name}" silinsin?`, message: 'Bu passkey ilə artıq daxil olmaq mümkün olmayacaq.', confirmLabel: 'Sil', danger: true }))
                        await run(() => removeDevice(d.id), 'Passkey silindi');
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          className="h-10 border border-line text-[13px]"
          onClick={async () => {
            if (await confirmAction({ title: 'Yeni bərpa kodu yaradılsın?', message: 'Köhnə kod etibarsız olacaq.', confirmLabel: 'Yarat' }))
              await run(async () => setNewCode(await rotateRecoveryCode()));
          }}
        >
          <KeyRound size={15} /> Bərpa kodu
        </Button>
        <Button
          variant="ghost"
          className="h-10 border border-line text-[13px] text-expense"
          onClick={async () => {
            if (await confirmAction({ title: 'Bu cihazdan çıxılsın?', message: 'Məlumatlar cihazda qalır, sadəcə sinxronizasiya dayanır.', confirmLabel: 'Çıxış', danger: true }))
              await run(logout, 'Çıxış edildi');
          }}
        >
          <LogOut size={15} /> Çıxış
        </Button>
      </div>
      {newCode && <RecoveryCodeDialog code={newCode} onClose={() => setNewCode(null)} />}
    </Box>
  );
}

function Box({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-bg p-4">
      <h3 className="mb-2 flex items-center gap-2 text-[15px] font-bold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function RecoveryCodeDialog({ code, onClose }: { code: string; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const showToast = useUI((s) => s.showToast);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#0b1629]/60 px-6" role="alertdialog" aria-modal="true" aria-labelledby="rc-title">
      <div className="w-full max-w-[360px] rounded-3xl bg-card p-5 text-ink shadow-2xl">
        <h2 id="rc-title" className="text-[18px] font-bold">Bərpa kodunuz</h2>
        <p className="mt-2 text-[13.5px] text-muted">
          Passkey olmayan yeni cihazda daxil olmaq üçün lazımdır. <b>Yalnız indi göstərilir</b> — parol menecerində və ya etibarlı yerdə saxlayın.
        </p>
        <p className="mt-4 select-all rounded-2xl bg-soft px-3 py-4 text-center font-mono text-[17px] font-bold tracking-wider">{code}</p>
        <Button
          variant="soft"
          className="mt-3 w-full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              showToast({ message: 'Kopyalandı' });
            } catch {
              showToast({ message: 'Kopyalamaq alınmadı — kodu əl ilə yazın', tone: 'error' });
            }
          }}
        >
          <Copy size={16} /> Kopyala
        </Button>
        <label className="mt-4 flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-5 w-5 accent-[#3565CE]" />
          Kodu təhlükəsiz yerdə saxladım
        </label>
        <Button className="mt-4 w-full" disabled={!saved} onClick={onClose}>
          Hazırdır
        </Button>
      </div>
    </div>
  );
}
