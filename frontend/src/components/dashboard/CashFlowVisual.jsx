import React from 'react';
import { ArrowRight, TrendingUp, TrendingDown, Package, ArrowDownRight, Wallet } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

// ✅ Dönem Nakit Akışı — "Kâr neden Kasaya eşit değil?" sorusuna görsel cevap
// Kasaya gelen − Stoka bağlanan − İşletme = Net Kasa Hareketi
// Kullanıcı "Net Kâr ≠ Kasa" durumunu tek bakışta kavrar.
export const CashFlowVisual = ({ totalIncome, stockInvestmentInExpense, operatingExpense, netProfit }) => {
  const net = totalIncome - stockInvestmentInExpense - operatingExpense;
  const isPositive = net >= 0;
  const hasAnyActivity = totalIncome > 0 || stockInvestmentInExpense > 0 || operatingExpense > 0;
  if (!hasAnyActivity) return null;

  return (
    <div
      className="bg-gradient-to-br from-card via-card to-primary/5 border border-border rounded-xl p-4 sm:p-5"
      data-testid="cash-flow-visual"
    >
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Wallet size={16} />
          </div>
          <h4 className="font-heading font-semibold text-sm">Dönem Nakit Akışı</h4>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Net Kâr ({formatCurrency(netProfit)}) ≠ Kasa: bu görsel farkı açıklar
        </span>
      </div>

      {/* Waterfall: 4 kutu yatay, aralarda → ikonu */}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 sm:gap-1 items-stretch">
        {/* Box 1: Gelir */}
        <div className="sm:col-span-2 bg-success/10 border border-success/30 rounded-lg p-3" data-testid="cf-income">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-success" />
            <span className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">Kasaya Giren</span>
          </div>
          <p className="font-heading font-bold text-base sm:text-lg tabular-nums text-success">
            +{formatCurrency(totalIncome)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Toplam Gelir</p>
        </div>

        {/* Arrow 1 */}
        <div className="hidden sm:flex items-center justify-center">
          <ArrowRight size={20} className="text-muted-foreground/40" />
        </div>

        {/* Box 2: Stoka Bağlanan */}
        <div className="sm:col-span-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3" data-testid="cf-stock">
          <div className="flex items-center gap-1.5 mb-1">
            <Package size={12} className="text-amber-500" />
            <span className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">Stoka Bağlanan</span>
          </div>
          <p className="font-heading font-bold text-base sm:text-lg tabular-nums text-amber-500">
            −{formatCurrency(stockInvestmentInExpense)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Araç alımları (varlık)</p>
        </div>

        {/* Arrow 2 (mobile: hidden) — ama bu sefer yer yok, boxları yan yana koyalım */}
        {/* sm:7 col grid; box1=2, ar=1, box2=2, ar=1, box3=2, ar=1, box4=2 → toplam 11 olur. Düzeltelim: 9 col */}

        {/* Box 3: İşletme Gideri */}
        <div className="sm:col-span-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3" data-testid="cf-operating">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowDownRight size={12} className="text-destructive" />
            <span className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">İşletme Gideri</span>
          </div>
          <p className="font-heading font-bold text-base sm:text-lg tabular-nums text-destructive">
            −{formatCurrency(operatingExpense)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Bakım, kira, maaş vb.</p>
        </div>

        {/* = */}
        <div className="hidden sm:flex items-center justify-center">
          <span className="font-bold text-muted-foreground/60 text-lg">=</span>
        </div>
      </div>

      {/* Sonuç satırı */}
      <div
        className={`mt-3 rounded-lg p-3 border ${
          isPositive
            ? 'bg-success/10 border-success/30'
            : 'bg-destructive/10 border-destructive/30'
        }`}
        data-testid="cf-result"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp size={16} className="text-success" />
            ) : (
              <TrendingDown size={16} className="text-destructive" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wider">
              Dönem Net Kasa Hareketi
            </span>
          </div>
          <p
            className={`font-heading font-bold text-xl sm:text-2xl tabular-nums ${
              isPositive ? 'text-success' : 'text-destructive'
            }`}
          >
            {isPositive ? '+' : ''}{formatCurrency(net)}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {isPositive
            ? `Bu dönemde kasanıza net ${formatCurrency(net)} giriş oldu. Net Kâr'dan farkı: stoka bağlanan ve işletme giderleri.`
            : `Bu dönemde kasadan net ${formatCurrency(Math.abs(net))} çıktı — büyük kısmı stoktaki araçlara yatırım. Stok satıldığında geri döner.`}
        </p>
      </div>
    </div>
  );
};

export default CashFlowVisual;
