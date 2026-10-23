import React, { useState } from 'react';
import { Wrench, ChevronRight, Package, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import VehicleExpensesModal from './VehicleExpensesModal';

// ✅ Stok Araçlar — Masraf Detay Modal
// Tıklanan "Araç Masraf" tile'ından açılır.
// Sadece stoktaki (satılmamış/silinmemiş) araçların masraflarını gösterir.
// Bir araca tıklanınca o aracın VehicleExpensesModal'ı açılır → tx ekle/düzenle/sil.
// Reactivity: silme/satış sonrası dış useMemo otomatik günceller, modal re-render olur.
const StockExpensesDetailModal = ({ isOpen, onClose, breakdown = [], grandTotal = 0 }) => {
  const [selectedCar, setSelectedCar] = useState(null);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="stock-expenses-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench size={20} className="text-amber-500" />
              Stok Araç Masrafları
            </DialogTitle>
          </DialogHeader>

          {/* Özet */}
          <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 mt-2">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Toplam Stok Araç Masrafı</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {breakdown.length} araç · Sadece henüz satılmamış araçlar
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tabular-nums text-amber-500" data-testid="stock-expenses-total">
              {formatCurrency(grandTotal)}
            </div>
          </div>

          {/* Liste */}
          {breakdown.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground border border-dashed border-border rounded-xl mt-3">
              <Package size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Stoktaki araçlara henüz bir masraf girilmemiş.</p>
              <p className="text-xs mt-1">Araç detay sayfasından masraf eklediğinizde burada görüntülenir.</p>
            </div>
          ) : (
            <div className="space-y-2 mt-3">
              {breakdown.map(({ car, total, txs }) => (
                <button
                  type="button"
                  key={car.id}
                  onClick={() => setSelectedCar(car)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors text-left"
                  data-testid={`stock-expense-row-${car.id}`}
                >
                  <div className="w-1 h-12 bg-amber-500 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {car.brand} {car.model}{' '}
                      <span className="text-muted-foreground font-normal">({car.year})</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {(car.plate || '').toUpperCase()} · {txs.length} masraf · {car.status}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <TrendingDown size={12} className="text-amber-500" />
                      <span className="text-base font-bold text-amber-500 tabular-nums">
                        {formatCurrency(total)}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">Detay için tıkla</div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground/50 shrink-0" />
                </button>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            Bir araca tıklayarak masrafları düzenleyebilir veya silebilirsiniz. Araç satıldığında veya silindiğinde
            bu listeden otomatik olarak çıkar.
          </p>
        </DialogContent>
      </Dialog>

      {/* Tek araç masraf detay modalı (alt seviye) */}
      <VehicleExpensesModal
        isOpen={!!selectedCar}
        onClose={() => setSelectedCar(null)}
        car={selectedCar}
      />
    </>
  );
};

export default StockExpensesDetailModal;
