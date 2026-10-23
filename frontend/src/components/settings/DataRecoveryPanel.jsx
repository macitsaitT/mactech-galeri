import React, { useEffect, useState } from 'react';
import { recoveryAPI } from '../../services/api';
import { LifeBuoy, AlertTriangle, RefreshCw, ArrowRightCircle, CheckCircle, Loader2 } from 'lucide-react';

const DataRecoveryPanel = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await recoveryAPI.status();
      setStatus(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Veri durumu alınamadı (backend güncel olmayabilir, deploy edin).');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRestoreAll = async () => {
    if (!window.confirm('Bu hesaba ait silinmiş tüm verileri (araç, müşteri, işlem) geri yüklemek istediğinize emin misiniz?')) return;
    setBusy(true);
    setResultMsg('');
    try {
      const res = await recoveryAPI.restoreAll();
      setResultMsg(`✅ Geri yükleme tamamlandı: ${res.data.cars_restored} araç, ${res.data.transactions_restored} işlem, ${res.data.customers_restored} müşteri.`);
      await load();
    } catch (e) {
      setResultMsg(`❌ ${e?.response?.data?.detail || 'Hata oluştu'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleMigrate = async (sourceOrgId, info) => {
    if (!window.confirm(`Eski hesabın (${info.cars} araç, ${info.transactions} işlem, ${info.customers} müşteri) verilerini bu hesaba aktarmak istediğinize emin misiniz?`)) return;
    setBusy(true);
    setResultMsg('');
    try {
      const res = await recoveryAPI.migrate(sourceOrgId);
      setResultMsg(`✅ Aktarım tamamlandı: ${res.data.cars_migrated} araç, ${res.data.transactions_migrated} işlem, ${res.data.customers_migrated} müşteri, ${res.data.capital_movements_migrated} kasa hareketi.`);
      await load();
      // Kullanıcı verileri görmek için sayfayı yenilesin
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setResultMsg(`❌ ${e?.response?.data?.detail || 'Aktarım başarısız'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border-2 border-amber-500/40 rounded-xl p-5" data-testid="data-recovery-panel">
      <div className="flex items-center gap-2 mb-1">
        <LifeBuoy size={18} className="text-amber-500" />
        <h3 className="font-semibold">Veri Kurtarma</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Verileriniz eksik mi? Burada hesabınıza ait silinmiş veya başka bir hesapta kalmış kayıtları görebilir, geri yükleyebilirsiniz.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin mr-2" /> Kontrol ediliyor...
        </div>
      ) : error ? (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm" data-testid="recovery-error">
          {error}
        </div>
      ) : status ? (
        <div className="space-y-3">
          {/* Hesap özeti */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 border border-border rounded-lg text-center">
              <div className="text-muted-foreground">Görünen</div>
              <div className="font-bold text-base text-success">{status.visible.cars + status.visible.transactions + status.visible.customers}</div>
              <div className="text-[10px] text-muted-foreground">{status.visible.cars}🚗 · {status.visible.transactions}💰 · {status.visible.customers}👤</div>
            </div>
            <div className="p-2.5 border border-amber-500/40 rounded-lg text-center bg-amber-500/5">
              <div className="text-muted-foreground">Silinmiş</div>
              <div className="font-bold text-base text-amber-500">{status.soft_deleted.cars + status.soft_deleted.transactions}</div>
              <div className="text-[10px] text-muted-foreground">{status.soft_deleted.cars}🚗 · {status.soft_deleted.transactions}💰</div>
            </div>
            <div className="p-2.5 border border-border rounded-lg text-center">
              <div className="text-muted-foreground">Eski Hesap</div>
              <div className="font-bold text-base">{status.same_email_orphan_data?.length || 0}</div>
              <div className="text-[10px] text-muted-foreground">aynı e-posta</div>
            </div>
          </div>

          {/* Geri yüklenebilir silinmiş veri */}
          {(status.soft_deleted.cars > 0 || status.soft_deleted.transactions > 0) && (
            <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold">{status.soft_deleted.cars} araç + {status.soft_deleted.transactions} işlem geri yüklenebilir</div>
                  <div className="text-muted-foreground">DB'de saklanıyor, sadece silinmiş olarak işaretli.</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRestoreAll}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-amber-500 text-white text-xs font-bold disabled:opacity-50 hover:bg-amber-600 transition-colors shrink-0"
                data-testid="restore-all-btn"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Tümünü Geri Yükle
              </button>
            </div>
          )}

          {/* Aynı e-postada başka hesapta kalan veri */}
          {status.same_email_orphan_data?.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Aynı E-Posta — Eski Hesaplarda Kalan Veriler:</div>
              {status.same_email_orphan_data.map((d) => (
                <div key={d.org_id} className="p-3 rounded-lg border-2 border-primary/40 bg-primary/5 flex items-center justify-between gap-3 flex-wrap" data-testid={`orphan-${d.org_id}`}>
                  <div className="text-xs min-w-0 flex-1">
                    <div className="font-semibold">
                      {d.cars} araç · {d.transactions} işlem · {d.customers} müşteri
                    </div>
                    <div className="text-muted-foreground">
                      Eski hesap: {d.created_at?.slice(0, 10)} · ID: {d.org_id?.slice(0, 8)}...
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMigrate(d.org_id, d)}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
                    data-testid={`migrate-${d.org_id}`}
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightCircle size={14} />}
                    Bu Hesaba Aktar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hiç sorun yok */}
          {status.soft_deleted.cars === 0 && status.soft_deleted.transactions === 0 && status.same_email_orphan_data?.length === 0 && (
            <div className="p-3 rounded-lg bg-success/10 text-success text-xs flex items-center gap-2">
              <CheckCircle size={14} /> Hesabınızda kayıp veri yok.
            </div>
          )}

          {/* Sonuç mesajı */}
          {resultMsg && (
            <div className="p-3 rounded-lg bg-muted text-sm" data-testid="recovery-result">{resultMsg}</div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default DataRecoveryPanel;
