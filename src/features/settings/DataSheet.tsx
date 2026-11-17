'use client';
import { CheckCircle2, Download, FlaskConical, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/controls';
import { Sheet } from '@/components/ui/Sheet';
import { useSettings } from '@/hooks/useData';
import { updateSettings } from '@/repositories';
import { analyzeImport, BACKUP_REMINDER_DAYS, buildBackup, importBackup, shareOrDownloadJSON, validateBackup } from '@/services/backup';
import { confirmAction, useUI } from '@/stores/ui';
import { formatDayMonth, toKey } from '@/utils/date';
import { haptic } from '@/utils/haptics';

export function lastBackupLabel(iso?: string) {
  if (!iso) return 'Hələ ehtiyat nüsxə çıxarılmayıb';
  const d = new Date(iso);
  return `Son ehtiyat nüsxə: ${formatDayMonth(toKey(d))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function DataSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const showToast = useUI((s) => s.showToast);
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);

  async function exportAll() {
    setBusy(true);
    try {
      const backup = await buildBackup();
      const result = await shareOrDownloadJSON(backup, `myagenda-backup-${toKey(new Date())}.json`);
      if (result === 'cancelled') return;
      await updateSettings({ lastBackupAt: new Date().toISOString() });
      haptic('success');
      showToast({ message: result === 'shared' ? 'Ehtiyat nüsxə paylaşıldı' : 'Ehtiyat nüsxə yükləndi' });
    } catch {
      showToast({ message: 'Ehtiyat nüsxə çıxarıla bilmədi', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  function pick(m: 'merge' | 'replace') {
    setMode(m);
    fileRef.current?.click();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Fayl çox böyükdür (maks. 25 MB)');
      const json = JSON.parse(await file.text());
      const res = validateBackup(json);
      if (!res.ok) throw new Error(res.error);
      const a = await analyzeImport(res.backup);
      const exported = res.backup.exportedAt ? formatDayMonth(toKey(new Date(res.backup.exportedAt))) : '—';
      const ok =
        mode === 'replace'
          ? await confirmAction({
              title: 'Məlumatlar əvəz olunsun?',
              message: `Bütün cari tapşırıq, görüş, qeyd və əməliyyatlar silinəcək və ${exported} tarixli nüsxədəki ${a.total} qeyd yazılacaq. Bu addımı geri qaytarmaq olmur.`,
              confirmLabel: 'Bərpa et',
              danger: true,
            })
          : await confirmAction({
              title: 'İdxal edilsin?',
              message: `Nüsxə: ${exported}. Yeni: ${a.newRecords}, yenilənəcək (eyni ID): ${a.sameId}, təkrar (ötürüləcək): ${a.contentDuplicates}.`,
              confirmLabel: 'İdxal et',
            });
      if (!ok) return;
      const n = await importBackup(res.backup, mode);
      haptic('success');
      showToast({ message: `${n} qeyd ${mode === 'replace' ? 'bərpa edildi' : 'idxal edildi'}` });
      onClose();
    } catch (e) {
      showToast({ message: e instanceof SyntaxError ? 'Fayl JSON formatında deyil' : (e as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Sinxronizasiya və ehtiyat nüsxə">
      <div className="space-y-3 pb-2 pt-1">
        <div className="flex items-center gap-3 rounded-2xl bg-bg p-4 text-[14px]">
          <CheckCircle2 size={20} className={settings.lastBackupAt ? 'text-income' : 'text-muted'} />
          <span>{lastBackupLabel(settings.lastBackupAt)}</span>
        </div>
        <div className="rounded-2xl bg-p-yellow p-4 text-[13.5px]">
          Məlumatlar yalnız bu cihazda (brauzerin IndexedDB yaddaşında, şifrələnmədən) saxlanılır. Avtomatik bulud ehtiyatı və
          sinxronizasiya yoxdur. iOS istifadə olunmayan saytların yaddaşını silə bilər, ona görə nüsxəni {BACKUP_REMINDER_DAYS} gündə bir
          çıxarın: paylaşma menyusundan «Fayllarda saxla» (iCloud Drive) seçə bilərsiniz.
        </div>
        <Button className="w-full" onClick={exportAll} disabled={busy}>
          <Download size={18} /> Ehtiyat nüsxə çıxar / paylaş
        </Button>
        <Button variant="soft" className="w-full" onClick={() => pick('merge')} disabled={busy}>
          <Upload size={18} /> İdxal et (birləşdir)
        </Button>
        <Button variant="danger" className="w-full" onClick={() => pick('replace')} disabled={busy}>
          <RotateCcw size={18} /> Ehtiyat nüsxədən bərpa et (əvəz et)
        </Button>
        <p className="px-1 text-xs text-muted">
          Birləşdirmə: eyni ID-li qeydlər yenilənir, eyni məzmunlu təkrarlar ötürülür. Bərpa: cari məlumatlar silinir və nüsxə yazılır.
          Hər iki halda əvvəlcə nüsxə yoxlanılır (format, versiya, sahələr).
        </p>
        {process.env.NODE_ENV === 'development' && <DemoButton />}
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
    </Sheet>
  );
}

function DemoButton() {
  const showToast = useUI((s) => s.showToast);
  return (
    <Button
      variant="ghost"
      className="w-full border border-dashed border-line"
      onClick={async () => {
        const { loadDemoData } = await import('@/services/demoData');
        await loadDemoData();
        showToast({ message: 'Demo məlumat yükləndi (dev)' });
      }}
    >
      <FlaskConical size={18} /> Demo məlumat yüklə (yalnız development)
    </Button>
  );
}
