import React from 'react';
import {
  Landmark, Gem, Wallet, Car, TrendingUp, TrendingDown, Briefcase, AlertCircle, Info
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { cn } from '../../lib/utils';

/**
 * Patron'un 5 saniyede tüm şirket durumunu okuduğu 6 ana kart.
 *
 * Muhasebe prensipleri:
 * - Araç alımı GİDER DEĞİLDİR (varlık dönüşümü)
 * - Kasadan çıkan para stoka bağlandı → toplam varlık değişmez
 * - Öz Sermaye = Başlangıç + Net Kâr − İşletme Giderleri
 */
const Card = ({ title, value, subtitle, icon: Icon, accent = 'default', testId, badge, warning }) => {
  const accentMap = {
    default: 'border-border bg-card',
    gold: 'border-ti-gold/40 bg-gradient-to-br from-ti-gold/10 to-card shadow-[inset_0_0_0_1px_rgba(197,162,103,0.15)]',
    cash: 'border-border bg-card',
    profit: 'border-emerald-500/30 bg-card',
    loss: 'border-rose-500/40 bg-card',
    warning: 'border-amber-500/40 bg-card',
  };
  const iconColorMap = {
    default: 'text-muted-foreground',
    gold: 'text-ti-gold',
    cash: 'text-sky-400',
    profit: 'text-emerald-400',
    loss: 'text-rose-400',
    warning: 'text-amber-400',
  };
  return (
    <div
      className={cn(
        'relative rounded-xl p-4 sm:p-5 border transition-all hover-lift',
        accentMap[accent] || accentMap.default
      )}
      data-testid={testId}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center bg-background/40', iconColorMap[accent] || iconColorMap.default)}>
          <Icon size={18} />
        </div>
        {badge && (
          <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-ti-gold/15 text-ti-gold">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground mb-1">{title}</p>
      <p className={cn(
        'font-heading font-bold tabular-nums leading-tight',
        accent === 'gold' ? 'text-2xl sm:text-3xl text-ti-gold' :
        accent === 'profit' ? 'text-2xl text-emerald-400' :
        accent === 'loss' ? 'text-2xl text-rose-400' :
        accent === 'warning' ? 'text-2xl text-amber-400' :
        'text-2xl text-foreground'
      )}>{value}</p>
      {subtitle && (
        <p className={cn(
          'text-[11px] mt-1.5 leading-snug',
          warning ? 'text-amber-400' : 'text-muted-foreground'
        )}>
          {warning && <AlertCircle size={11} className="inline mr-1 -mt-0.5" />}
          {subtitle}
        </p>
      )}
    </div>
  );
};

export const FinanceSummaryCards = ({ summary, onEditFounding, canEditFounding }) => {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="finance-summary-skeleton">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="h-32 rounded-xl bg-card/50 border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  const {
    founding_capital = 0,
    current_equity = 0,
    cash_balance = 0,
    stock_value = 0,
    net_profit = 0,
    total_assets = 0,
    stock_count = 0,
    consignment_count = 0,
    cash_is_negative,
    cash_explanation,
    equity_change = 0,
    equity_change_pct = 0,
    sold_count_period = 0,
  } = summary;

  const equityUp = equity_change >= 0;
  const profitUp = net_profit >= 0;
  const showFoundingPlaceholder = founding_capital <= 0;

  return (
    <div className="space-y-3" data-testid="finance-summary">
      {/* Üst bant — Açıklama */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border">
        <Info size={12} className="text-ti-gold flex-shrink-0" />
        <span>
          Tüm değerler muhasebe prensiplerine göre hesaplanır. <span className="text-ti-gold font-semibold">Araç alımları gider değil, varlıktır.</span>
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Başlangıç Sermayesi */}
        <Card
          testId="card-founding-capital"
          title="Başlangıç Sermayesi"
          value={showFoundingPlaceholder ? '—' : formatCurrency(founding_capital)}
          subtitle={showFoundingPlaceholder
            ? (canEditFounding ? '👆 Tanımlamak için tıkla' : 'Henüz tanımlanmadı')
            : 'Sabit öz sermaye referansı'}
          icon={Landmark}
          accent="default"
        />

        {/* 2. Güncel Öz Sermaye — En önemli kart */}
        <Card
          testId="card-current-equity"
          title="Güncel Öz Sermaye"
          value={formatCurrency(current_equity)}
          subtitle={
            founding_capital > 0
              ? `${equityUp ? '↑' : '↓'} ${formatCurrency(Math.abs(equity_change))} (${equityUp ? '+' : ''}${equity_change_pct}%)`
              : 'Şirketinizin gerçek değeri'
          }
          icon={Gem}
          accent="gold"
          badge="ÖZ SERMAYE"
        />

        {/* 3. Kasadaki Nakit */}
        <Card
          testId="card-cash-balance"
          title="Kasadaki Nakit"
          value={formatCurrency(cash_balance)}
          subtitle={cash_is_negative ? cash_explanation : 'Anlık nakit pozisyonu'}
          warning={cash_is_negative}
          icon={Wallet}
          accent={cash_is_negative ? 'warning' : 'cash'}
        />

        {/* 4. Stoktaki Araç Değeri */}
        <Card
          testId="card-stock-value"
          title="Stok Araç Değeri"
          value={formatCurrency(stock_value)}
          subtitle={`${stock_count} stok · ${consignment_count} konsinye (tam maliyetle)`}
          icon={Car}
          accent="default"
        />

        {/* 5. Net Kâr / Zarar */}
        <Card
          testId="card-net-profit"
          title={profitUp ? 'Net Kâr' : 'Net Zarar'}
          value={formatCurrency(net_profit)}
          subtitle={sold_count_period > 0
            ? `${sold_count_period} satış · brüt kâr−maliyet`
            : 'Sadece satılan araçlardan'}
          icon={profitUp ? TrendingUp : TrendingDown}
          accent={profitUp ? 'profit' : 'loss'}
        />

        {/* 6. Toplam Varlık */}
        <Card
          testId="card-total-assets"
          title="Toplam Varlık"
          value={formatCurrency(total_assets)}
          subtitle="Nakit + Stok değeri"
          icon={Briefcase}
          accent="default"
        />
      </div>

      {/* Founding Capital tıklanabilir */}
      {showFoundingPlaceholder && canEditFounding && (
        <button
          onClick={onEditFounding}
          className="w-full text-xs text-ti-gold hover:text-ti-gold-light underline-offset-2 hover:underline transition-colors py-1"
          data-testid="set-founding-btn"
        >
          Doğru muhasebe için → Başlangıç sermayenizi tanımlayın
        </button>
      )}
    </div>
  );
};

export default FinanceSummaryCards;
