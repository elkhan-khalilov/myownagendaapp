'use client';
import { useEffect, useState } from 'react';
import { Button, Field, Input, Select } from '@/components/ui/controls';
import { Sheet } from '@/components/ui/Sheet';
import { useSettings } from '@/hooks/useData';
import { updateSettings } from '@/repositories';
import { useUI } from '@/stores/ui';
import type { Currency } from '@/types';

export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();
  const showToast = useUI((x) => x.showToast);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState<Currency>('AZN');
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(s.name);
      setEmail(s.email ?? '');
      setCurrency(s.currency);
      setErr({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Ad tələb olunur';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'E-poçt düzgün deyil';
    setErr(e);
    if (Object.keys(e).length) return;
    await updateSettings({ name: name.trim(), email: email.trim(), currency });
    showToast({ message: 'Parametrlər yadda saxlanıldı' });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Parametrlər" footer={<Button className="w-full" onClick={save}>Yadda saxla</Button>}>
      <div className="space-y-4 pt-1">
        <Field label="Ad" error={err.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} />
        </Field>
        <Field label="E-poçt (istəyə bağlı)" error={err.email}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" maxLength={120} />
        </Field>
        <Field label="Əsas valyuta" hint="Məbləğlər qəpik/sent kimi tam ədədlə saxlanılır; valyuta yalnız göstərilmə üçündür.">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="AZN">AZN — Azərbaycan manatı (₼)</option>
            <option value="USD">USD — ABŞ dolları ($)</option>
            <option value="EUR">EUR — Avro (€)</option>
          </Select>
        </Field>
        <div className="rounded-2xl bg-bg p-4 text-[13px] text-muted">
          <b className="text-ink">Təhlükəsizlik:</b> Bu versiya tam oflayn işləyir və hesab/şifrə saxlamır. Məlumatlar cihazda şifrələnmədən saxlanılır; Face ID ilə kilid PWA-da mövcud deyil — telefonun öz kilidindən istifadə edin. Backend (FastAPI) qoşulanda təhlükəsiz giriş əlavə olunacaq.
        </div>
      </div>
    </Sheet>
  );
}
