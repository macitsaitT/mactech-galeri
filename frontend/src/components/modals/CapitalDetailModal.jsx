import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, Coins, Car as CarIcon, ArrowDownCircle, ArrowUpCircle, RefreshCw, X, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useApp } from '../../context/AppContext';
import { capitalAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';

/**
 * Sermaye Detay Modalı
 * - Üstte: Toplam Sermaye = Nakit + Araç Envanteri Değeri
 * - Tab 1 "Nakit": kasa hareketleri (capital_movements)
 * - Tab 2 "Araç Envanteri": stok araçlar listesi (her biri alış değeri ile)
 */
const REASON_LABEL = {
  manual_deposit: 'Kasa Girişi',
  manual_withdrawal: 'Kasa Çıkışı',
  manual_set: 'Bakiye Düzenleme',
  capital_initialize: 'İlk Kurulum',
  transaction_create: 'İşlem',
  transaction_update: 'İşlem Güncelleme',
  transaction_delete: 'İşlem Silme',
  transaction_restore: 'İşlem Geri Yükleme',
  transaction_create_rollback: 'İşlem Geri Alma',
  employee_share_sync: 'Çalışan Payı Senkron',
  employee_share_create: 'Çalışan Payı',
};

const CapitalDetailModal = ({ isOpen, onClose }) => {
  const { capital, cars, refreshCapital, fetchData } = useApp();
  const [tab, setTab] = useState('cash');
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);

  const cashAmount = Number(capital?.amount || 0);

  const reload = () => {
    setLoading(true);
    capitalAPI.movements(200)
      .then(res => setMovements(res.data?.movements || []))
      .catch(() => setMovements([]))
      .finally(() => setLoading(false));
  };

  const handleDeleteMovement = async (mv) => {
    if (!window.confirm(`Bu hareketi silmek istediğinize emin misiniz?\n\n${mv.description || ''}\nTutar: ${formatCurrency(mv.delta)}`)) return;
    try {
      await capitalAPI.deleteMovement(mv.id);
      // Local + global state'i yenile
      reload();
      if (typeof refreshCapital === 'function') await refreshCapital();
      if (typeof fetchData === 'function') await fetchData();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Silinemedi');
    }
  };

  // Stok'ta olan (henüz satılmamış, silinmemiş) araçların alış değerleri
  const stockCars = useMemo(() => {
    return (cars || []).filter(c =>
      !c.deleted &&
      c.status !== 'Satıldı' &&
      c.ownership === 'stock'
    );
  }, [cars]);

  const vehicleValue = useMemo(
    () => stockCars.reduce((s, c) => s + Number(c.purchase_price || 0), 0),
    [stockCars]
  );

  const totalCapital = cashAmount + vehicleValue;

  useEffect(() => {
    if (!isOpen) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet size={22} className="text-primary" />
            Sermaye Detayı
          </DialogTitle>
        </DialogHeader>

        {/* Üst özet */}
        <div className="mt-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 sm:p-5">
          <div className="text-xs uppercase tracking-[0.14em] text-primary/80 font-semibold">Toplam Sermaye</div>
          <div className="mt-1 text-3xl sm:text-4xl font-extrabold text-primary break-all" data-testid="total-capital-amount">
            {formatCurrency(totalCapital)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Nakit + araç envanterinin alış değeri.</div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTab('cash')}
              className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${
                tab === 'cash'
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background/60 hover:bg-muted'
              }`}
              data-testid="capital-tab-cash"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Coins size={13} /> Nakit
              </span>
              <span className="mt-1 text-base sm:text-lg font-bold">{formatCurrency(cashAmount)}</span>
              <span className="text-[10px] text-muted-foreground">Detay için tıkla</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('inventory')}
              className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${
                tab === 'inventory'
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background/60 hover:bg-muted'
              }`}
              data-testid="capital-tab-inventory"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <CarIcon size={13} /> Araç ({stockCars.length})
              </span>
              <span className="mt-1 text-base sm:text-lg font-bold">{formatCurrency(vehicleValue)}</span>
              <span className="text-[10px] text-muted-foreground">Detay için tıkla</span>
            </button>
          </div>
        </div>

        {/* Tab içerik */}
        <div className="mt-4">
          {tab === 'cash' && (
            <CashTab movements={movements} loading={loading} onDelete={handleDeleteMovement} />
          )}
          {tab === 'inventory' && (
            <InventoryTab cars={stockCars} totalValue={vehicleValue} />
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <X size={16} /> Kapat
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DELETABLE_REASONS = new Set([
  // Manuel hareketler
  'manual_deposit', 'manual_withdrawal', 'manual_set', 'capital_initialize',
  // Transaction-bağlı hareketler (silindiğinde ilgili tx de soft-delete edilir)
  'transaction_create', 'transaction_update', 'transaction_restore',
]);

const CashTab = ({ movements, loading, onDelete }) => {
  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</div>;
  }
  if (!movements.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Henüz nakit hareketi yok.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
        <RefreshCw size={12} /> Son {movements.length} Hareket
      </div>
      {movements.map((m) => {
        const canDelete = DELETABLE_REASONS.has(m.reason);
        return (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm"
            data-testid={`cash-movement-${m.id}`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {m.delta >= 0 ? (
                <ArrowDownCircle size={16} className="text-success shrink-0" />
              ) : (
                <ArrowUpCircle size={16} className="text-destructive shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-medium truncate">{REASON_LABEL[m.reason] || m.reason}</div>
                {m.description && (
                  <div className="text-xs text-muted-foreground truncate">{m.description}</div>
                )}
                <div className="text-[10px] text-muted-foreground">{formatDate(m.created_at)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <div className={`font-bold ${m.delta >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {m.delta >= 0 ? '+' : ''}{formatCurrency(m.delta)}
                </div>
                <div className="text-[10px] text-muted-foreground">Bakiye: {formatCurrency(m.balance_after)}</div>
              </div>
              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(m)}
                  className="w-8 h-8 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                  data-testid={`delete-movement-${m.id}`}
                  title="Bu manuel hareketi sil"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const InventoryTab = ({ cars, totalValue }) => {
  if (!cars.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Stokta araç yok. Yeni araç eklendiğinde burada görünecek.
      </div>
    );
  }
  // Alış değerine göre azalan sırala
  const sorted = [...cars].sort((a, b) => Number(b.purchase_price || 0) - Number(a.purchase_price || 0));
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
        <span>{cars.length} araç envanterde</span>
        <span className="text-primary">Toplam: {formatCurrency(totalValue)}</span>
      </div>
      {sorted.map((c) => {
        const photo = (c.photos && c.photos[0]) || (c.images && c.images[0]) || null;
        const photoUrl = typeof photo === 'string' ? photo : (photo?.url || photo?.data || null);
        return (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2.5"
            data-testid={`inventory-row-${c.id}`}
          >
            <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} alt={c.model} className="h-full w-full object-cover" />
              ) : (
                <CarIcon size={18} className="text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">
                {c.brand} {c.model} {c.year ? `· ${c.year}` : ''}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {(c.plate || '').toUpperCase()} {c.package_info ? `· ${c.package_info}` : ''}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Alış</div>
              <div className="font-bold text-primary text-sm">{formatCurrency(c.purchase_price || 0)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CapitalDetailModal;
