import React from 'react';
import { Info, Package, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

// ✅ Gider Analizi — "Stok Yatırımı" (Varlık) vs "İşletme Gideri" ayrımı
// Kullanıcının "Toplam Gider" rakamını yanlış anlamasını engeller.
export const ExpenseBreakdownBar = ({ totalExpense, stockInvestmentInExpense, operatingExpense }) => {
  if (!totalExpense || stockInvestmentInExpense <= 0) return null;
  const stockPct = (stockInvestmentInExpense / totalExpense) * 100;
  const opPct = (operatingExpense / totalExpense) * 100;

  return (
    <div
      className="bg-gradient-to-r from-amber-500/5 via-card to-card border border-amber-500/20 rounded-xl p-4 sm:p-5"
      data-testid="expense-breakdown-bar"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 flex-shrink-0">
          <Info size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h4 className="font-heading font-semibold text-sm">Gider Analizi — Toplam Giderin Dağılımı</h4>
            <span className="text-[11px] text-muted-foreground">
              "Toplam Gider"in {Math.round(stockPct)}%'i aslında stoktaki araçlarda duran varlığınız
            </span>
          </div>

          {/* Stacked progress bar */}
          <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/40 mb-3">
            <div
              className="bg-amber-500 transition-all"
              style={{ width: `${stockPct}%` }}
              data-testid="expense-stock-bar"
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${opPct}%` }}
              data-testid="expense-operating-bar"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 bg-background/60 border border-amber-500/20 rounded-lg p-3" data-testid="expense-stock-card">
              <div className="w-1 h-10 bg-amber-500 rounded-full flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Package size={12} className="text-amber-500" />
                  <span className="text-[11px] text-muted-foreground uppercase font-medium">Stok Yatırımı (Varlık)</span>
                </div>
                <p className="font-heading font-bold text-base sm:text-lg tabular-nums text-amber-500 mt-0.5">
                  {formatCurrency(stockInvestmentInExpense)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Araç alım bedelleri — satıldıkça nakde döner</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-background/60 border border-red-500/20 rounded-lg p-3" data-testid="expense-operating-card">
              <div className="w-1 h-10 bg-red-500 rounded-full flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <ArrowDownRight size={12} className="text-red-500" />
                  <span className="text-[11px] text-muted-foreground uppercase font-medium">İşletme Gideri</span>
                </div>
                <p className="font-heading font-bold text-base sm:text-lg tabular-nums text-red-500 mt-0.5">
                  {formatCurrency(operatingExpense)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Bakım, kira, maaş, vergi vb. gerçek giderler</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseBreakdownBar;
