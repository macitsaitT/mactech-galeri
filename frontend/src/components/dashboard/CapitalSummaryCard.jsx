import React, { useMemo } from 'react';
import { Wallet, Coins, Car as CarIcon, Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

// ✅ Toplam Sermaye (Nakit + Araç) özet kartı — Dashboard.jsx'ten ayrıldı
export const CapitalSummaryCard = ({ cars, cashAmount, onOpenDetail, onOpenAction }) => {
  const stockCars = useMemo(() => (cars || []).filter(c =>
    !c.deleted && c.status !== 'Satıldı' && c.ownership === 'stock'
  ), [cars]);
  const vehicleValue = useMemo(
    () => stockCars.reduce((s, c) => s + Number(c.purchase_price || 0), 0),
    [stockCars]
  );
  const total = cashAmount + vehicleValue;

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
            Toplam Sermaye
          </div>
          <button
            type="button"
            onClick={onOpenDetail}
            className="mt-2 text-left hover:opacity-80 transition-opacity"
            data-testid="capital-amount-display"
          >
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary break-all">
              {formatCurrency(total)}
            </div>
            <div className="text-xs text-muted-foreground">Detay için tıkla</div>
          </button>
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

      {/* 2 Mini Chip: Nakit / Araç (tıklanabilir) */}
      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenDetail}
          className="flex items-center justify-between rounded-xl border border-border bg-background/60 p-3 text-left transition-colors hover:bg-primary/5"
          data-testid="capital-cash-chip"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Coins size={16} className="text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nakit</div>
              <div className="text-sm sm:text-base font-bold truncate">{formatCurrency(cashAmount)}</div>
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={onOpenDetail}
          className="flex items-center justify-between rounded-xl border border-border bg-background/60 p-3 text-left transition-colors hover:bg-primary/5"
          data-testid="capital-inventory-chip"
        >
          <div className="flex items-center gap-2 min-w-0">
            <CarIcon size={16} className="text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Araç ({stockCars.length})</div>
              <div className="text-sm sm:text-base font-bold truncate">{formatCurrency(vehicleValue)}</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default CapitalSummaryCard;
