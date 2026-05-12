import React, { useMemo, useState } from 'react';
import { Wallet, Coins, Car as CarIcon, Plus, TrendingUp, ArrowDownRight, Pencil } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { capitalAPI } from '../../services/api';
import { toast } from 'sonner';

// ✅ Toplam Sermaye (Nakit + Araç) özet kartı — 4-tile hiyerarşi:
// [Sermaye (kuruluş)] [Net Kâr] [Araç Masraf (auto)] [Toplam Sermaye]
// Araç Masraf = Toplam Sermaye − Kuruluş Sermayesi − Net Kâr
export const CapitalSummaryCard = ({
  cars,
  cashAmount,
  foundingCapital = 0,
  netProfit = 0,
  onOpenDetail,
  onOpenAction,
  onFoundingUpdated,
}) => {
  const stockCars = useMemo(() => (cars || []).filter(c =>
    !c.deleted && c.status !== 'Satıldı' && c.ownership === 'stock'
  ), [cars]);
  const vehicleValue = useMemo(
    () => stockCars.reduce((s, c) => s + Number(c.purchase_price || 0), 0),
    [stockCars]
  );
  const total = cashAmount + vehicleValue;

  // Otomatik hesap — kullanıcı isteği
  const aracMasraf = total - foundingCapital - netProfit;

  const [saving, setSaving] = useState(false);

  const handleEditFounding = async () => {
    const current = Number(foundingCapital || 0).toLocaleString('tr-TR');
    const raw = window.prompt(
      `Kuruluş Sermayesi (mevcut: ₺${current}):\n\nBu değer Dashboard'daki "Sermaye" kutucuğunda gösterilir.`,
      String(foundingCapital || 0)
    );
    if (raw === null) return;
    const cleaned = String(raw).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
    const amount = Number(cleaned);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('Geçerli bir tutar girin');
      return;
    }
    try {
      setSaving(true);
      await capitalAPI.setFounding(amount);
      toast.success(`Kuruluş Sermayesi güncellendi: ₺${amount.toLocaleString('tr-TR')}`);
      onFoundingUpdated?.();
    } catch (e) {
      toast.error('Kuruluş sermayesi kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 sm:p-6"
      data-testid="capital-card"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
            <Wallet size={14} />
            Sermaye Özeti
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Detay için tıkla</div>
        </div>
        <button
          type="button"
          onClick={onOpenAction}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-primary/40 bg-background/60 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          data-testid="open-capital-modal-btn"
        >
          <Plus size={16} />
          Kasa İşlemi
        </button>
      </div>

      {/* ✅ 4-Tile Hiyerarşi: Sermaye / Net Kâr / Araç Masraf / Toplam Sermaye */}
      <div className="relative mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Sermaye (kuruluş — tıklanabilir, düzenlenebilir) */}
        <button
          type="button"
          onClick={handleEditFounding}
          disabled={saving}
          className="group relative flex flex-col rounded-xl border border-border bg-background/60 p-3 text-left transition-colors hover:bg-primary/5 disabled:opacity-50"
          data-testid="capital-tile-founding"
          title="Kuruluş sermayesini düzenle"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Coins size={14} className="text-primary shrink-0" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">Sermaye</span>
            </div>
            <Pencil size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
          </div>
          <div className="mt-1 text-sm sm:text-base font-bold tabular-nums truncate text-foreground">
            {formatCurrency(foundingCapital)}
          </div>
        </button>

        {/* Net Kâr */}
        <div
          className="flex flex-col rounded-xl border border-success/30 bg-success/5 p-3"
          data-testid="capital-tile-netprofit"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <TrendingUp size={14} className="text-success shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">Net Kâr</span>
          </div>
          <div className="mt-1 text-sm sm:text-base font-bold tabular-nums truncate text-success">
            {formatCurrency(netProfit)}
          </div>
        </div>

        {/* Araç Masraf (auto-calculated) */}
        <div
          className={`flex flex-col rounded-xl border p-3 ${
            aracMasraf >= 0
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-destructive/30 bg-destructive/5'
          }`}
          data-testid="capital-tile-aracmasraf"
          title="Toplam Sermaye − Sermaye − Net Kâr"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <ArrowDownRight size={14} className={`shrink-0 ${aracMasraf >= 0 ? 'text-amber-500' : 'text-destructive'}`} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">Araç Masraf</span>
          </div>
          <div className={`mt-1 text-sm sm:text-base font-bold tabular-nums truncate ${aracMasraf >= 0 ? 'text-amber-500' : 'text-destructive'}`}>
            {formatCurrency(aracMasraf)}
          </div>
        </div>

        {/* Toplam Sermaye (büyük, vurgulu) */}
        <button
          type="button"
          onClick={onOpenDetail}
          className="flex flex-col rounded-xl border-2 border-primary/40 bg-primary/10 p-3 text-left transition-colors hover:bg-primary/15"
          data-testid="capital-tile-total"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Wallet size={14} className="text-primary shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-primary font-semibold truncate">Toplam Sermaye</span>
          </div>
          <div className="mt-1 text-base sm:text-lg font-extrabold tabular-nums truncate text-primary" data-testid="capital-amount-display">
            {formatCurrency(total)}
          </div>
        </button>
      </div>

      {/* Alt satır — Nakit & Araç breakdown (mevcut UI korunuyor) */}
      <div className="relative mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenDetail}
          className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-2.5 text-left transition-colors hover:bg-primary/5"
          data-testid="capital-cash-chip"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Coins size={14} className="text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Nakit</div>
              <div className="text-xs sm:text-sm font-semibold truncate tabular-nums">{formatCurrency(cashAmount)}</div>
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={onOpenDetail}
          className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-2.5 text-left transition-colors hover:bg-primary/5"
          data-testid="capital-inventory-chip"
        >
          <div className="flex items-center gap-2 min-w-0">
            <CarIcon size={14} className="text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Araç ({stockCars.length})</div>
              <div className="text-xs sm:text-sm font-semibold truncate tabular-nums">{formatCurrency(vehicleValue)}</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default CapitalSummaryCard;
