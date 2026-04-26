import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, Coins, Car as CarIcon, ArrowDownCircle, ArrowUpCircle, RefreshCw, X, Trash2, Check, Loader2, CheckSquare, Square } from 'lucide-react';
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
  // ✅ Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const cashAmount = Number(capital?.amount || 0);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await capitalAPI.movements(500);
      setMovements(res.data?.movements || []);
    } catch {
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Tek tek silme (legacy — selection mode dışında çağrılır)
  const handleDeleteMovement = async (e, mv) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setErrorMsg('');
    try {
      await capitalAPI.deleteMovement(mv.id);
      // Optimistic update — listeden çıkar (görsel olarak hemen kaybolsun)
      setMovements(prev => prev.filter(m => m.id !== mv.id));
      // Arka planda gerçek state'i çek
      reload();
      if (typeof refreshCapital === 'function') refreshCapital();
      if (typeof fetchData === 'function') fetchData();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Silinemedi';
      setErrorMsg(typeof detail === 'string' ? detail : 'Silinemedi');
    }
  };

  // ✅ Toplu silme
  const handleBulkDelete = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    setErrorMsg('');
    const ids = Array.from(selectedIds);

    let okCount = 0;
    let failCount = 0;
    const results = await Promise.allSettled(
      ids.map(id => capitalAPI.deleteMovement(id))
    );
    results.forEach(r => { if (r.status === 'fulfilled') okCount++; else failCount++; });

    // Optimistic — silinenleri listeden çıkar
    setMovements(prev => prev.filter(m => !ids.includes(m.id)));
    setBulkDeleting(false);
    setSelectedIds(new Set());
    // ✅ selectionMode AÇIK kalıyor — bulk-delete-btn DOM'da ve focus'lu kalır,
    // Radix Dialog focus-trap modal'ı kapatamaz. Kullanıcı dilediğinde "İptal" der.

    // Arka planda gerçek state'i çek
    reload();
    if (typeof refreshCapital === 'function') refreshCapital();
    if (typeof fetchData === 'function') fetchData();

    if (failCount > 0) {
      setErrorMsg(`${okCount} hareket silindi, ${failCount} tanesi silinemedi.`);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === movements.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(movements.map(m => m.id)));
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
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
            <CashTab
              movements={movements}
              loading={loading}
              onDelete={handleDeleteMovement}
              selectionMode={selectionMode}
              setSelectionMode={(v) => { setSelectionMode(v); setSelectedIds(new Set()); setErrorMsg(''); }}
              selectedIds={selectedIds}
              toggleSelected={toggleSelected}
              toggleSelectAll={toggleSelectAll}
              onBulkDelete={handleBulkDelete}
              bulkDeleting={bulkDeleting}
              errorMsg={errorMsg}
            />
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

const CashTab = ({
  movements, loading, onDelete,
  selectionMode, setSelectionMode, selectedIds, toggleSelected, toggleSelectAll,
  onBulkDelete, bulkDeleting, errorMsg,
}) => {
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
  const allSelected = movements.length > 0 && selectedIds.size === movements.length;
  return (
    <div className="space-y-1.5">
      {/* Toolbar — bütün butonlar her zaman DOM'da, conditional `hidden` ile gizleniyor.
          Bu sayede tıklanan button DOM'dan kaybolmaz → Radix Dialog focus-trap modal'ı kapatmaz. */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <RefreshCw size={12} /> Son {movements.length} Hareket
          {selectionMode && selectedIds.size > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
              {selectedIds.size} seçildi
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectionMode(true); }}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors ${selectionMode ? 'hidden' : ''}`}
            data-testid="enter-selection-mode-btn"
          >
            <CheckSquare size={12} /> Seç
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelectAll(); }}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors ${selectionMode ? '' : 'hidden'}`}
            data-testid="toggle-select-all-btn"
          >
            {allSelected ? <Square size={12} /> : <CheckSquare size={12} />}
            {allSelected ? 'Hiçbirini Seçme' : 'Tümünü Seç'}
          </button>
          <button
            type="button"
            onClick={(e) => onBulkDelete(e)}
            disabled={selectedIds.size === 0 || bulkDeleting}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold disabled:opacity-50 transition-colors ${selectionMode ? '' : 'hidden'}`}
            data-testid="bulk-delete-btn"
          >
            {bulkDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {bulkDeleting ? 'Siliniyor...' : `Sil (${selectedIds.size})`}
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectionMode(false); }}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border text-xs hover:bg-muted transition-colors text-muted-foreground ${selectionMode ? '' : 'hidden'}`}
            data-testid="exit-selection-mode-btn"
          >
            <X size={12} /> İptal
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 mb-2 rounded-lg bg-destructive/10 text-destructive text-xs" data-testid="capital-error-msg">
          {errorMsg}
        </div>
      )}

      {movements.map((m) => {
        const isSelected = selectedIds.has(m.id);
        return (
          <div
            key={m.id}
            onClick={selectionMode ? () => toggleSelected(m.id) : undefined}
            className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors ${
              selectionMode ? 'cursor-pointer' : ''
            } ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}
            data-testid={`cash-movement-${m.id}`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {selectionMode && (
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-primary border-primary' : 'bg-background border-border'
                }`}>
                  {isSelected && <Check size={12} className="text-primary-foreground" />}
                </div>
              )}
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
              {!selectionMode && onDelete && (
                <button
                  type="button"
                  onClick={(e) => onDelete(e, m)}
                  className="w-8 h-8 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                  data-testid={`delete-movement-${m.id}`}
                  title="Bu hareketi sil"
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
