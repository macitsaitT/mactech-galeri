import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/helpers';
import { Trophy, Car, Calendar, Target, TrendingUp, Award } from 'lucide-react';

// ✅ Satış personeli için kişiselleştirilmiş dashboard:
// - Sermaye/finansal kartlar yok
// - Sadece kendi satış verilerini gösterir
const SalesPersonalView = () => {
  const { cars, user, customers } = useApp();
  const [monthlyTarget, setMonthlyTarget] = useState(() => {
    try {
      const saved = localStorage.getItem(`mactech_sales_target_${user?.id}`);
      return saved ? parseInt(saved, 10) : 5;
    } catch {
      return 5;
    }
  });
  const [editingTarget, setEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(monthlyTarget);

  const saveTarget = (val) => {
    const num = Math.max(1, Math.min(100, parseInt(val, 10) || 1));
    setMonthlyTarget(num);
    try {
      localStorage.setItem(`mactech_sales_target_${user?.id}`, String(num));
    } catch {
      // ignore
    }
  };

  const myStats = useMemo(() => {
    const userId = user?.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

    const myCars = (cars || []).filter(
      (c) => !c.deleted && c.status === 'Satıldı' && c.sold_by_user_id === userId
    );

    const monthCars = myCars.filter((c) => (c.sold_date || '') >= monthStart);
    const yearCars = myCars.filter((c) => (c.sold_date || '') >= yearStart);

    const totalCommission = myCars.reduce((s, c) => s + Number(c.employee_share || 0), 0);
    const monthCommission = monthCars.reduce((s, c) => s + Number(c.employee_share || 0), 0);

    return {
      total: myCars.length,
      thisMonth: monthCars.length,
      thisYear: yearCars.length,
      totalCommission,
      monthCommission,
      myCars: myCars.slice().sort((a, b) => (b.sold_date || '').localeCompare(a.sold_date || '')),
    };
  }, [cars, user?.id]);

  const targetProgress = monthlyTarget > 0 ? Math.min(100, (myStats.thisMonth / monthlyTarget) * 100) : 0;
  const targetReached = myStats.thisMonth >= monthlyTarget;

  return (
    <div className="space-y-5 pb-24 md:pb-6 animate-fade-in" data-testid="sales-personal-view">
      {/* Karşılama */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <Trophy size={24} className="text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-bold">Hoş geldin, {user?.name || user?.company_name || user?.email?.split('@')[0] || 'Satışçı'}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Bu sayfada kendi satış performansını görüyorsun</p>
          </div>
        </div>
      </div>

      {/* Aylık Hedef Kartı */}
      <div
        className={`rounded-2xl p-5 border-2 ${
          targetReached ? 'bg-success/5 border-success/40' : 'bg-card border-border'
        }`}
        data-testid="monthly-target-card"
      >
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Target size={18} className={targetReached ? 'text-success' : 'text-primary'} />
            <h3 className="font-semibold text-sm sm:text-base">Bu Ay Hedef</h3>
            {targetReached && (
              <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1">
                <Award size={12} /> Tebrikler!
              </span>
            )}
          </div>
          {editingTarget ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={tempTarget}
                onChange={(e) => setTempTarget(e.target.value)}
                className="w-20 h-8 px-2 bg-background border border-border rounded-lg text-sm tabular-nums"
                data-testid="target-input"
              />
              <button
                onClick={() => { saveTarget(tempTarget); setEditingTarget(false); }}
                className="h-8 px-3 bg-primary text-primary-foreground rounded-lg text-xs font-semibold"
                data-testid="target-save"
              >Kaydet</button>
              <button
                onClick={() => { setTempTarget(monthlyTarget); setEditingTarget(false); }}
                className="h-8 px-3 border border-border rounded-lg text-xs"
              >İptal</button>
            </div>
          ) : (
            <button
              onClick={() => { setTempTarget(monthlyTarget); setEditingTarget(true); }}
              className="text-xs px-3 py-1.5 bg-muted hover:bg-muted/70 rounded-lg"
              data-testid="target-edit-btn"
            >Hedef Düzenle</button>
          )}
        </div>

        <div className="flex items-end gap-3 mb-3">
          <div>
            <div className="text-3xl sm:text-4xl font-bold tabular-nums">
              <span className={targetReached ? 'text-success' : ''}>{myStats.thisMonth}</span>
              <span className="text-muted-foreground text-xl">/{monthlyTarget}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">araç satıldı</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(myStats.monthCommission)}</div>
            <p className="text-xs text-muted-foreground">bu ay komisyonum</p>
          </div>
        </div>

        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${targetReached ? 'bg-success' : 'bg-primary'}`}
            style={{ width: `${targetProgress}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 text-right">
          {targetReached
            ? `🎉 Hedefin ${myStats.thisMonth - monthlyTarget} araç üzerinde!`
            : `Hedefe ${monthlyTarget - myStats.thisMonth} araç kaldı`}
        </p>
      </div>

      {/* Stat kartlar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="my-stats-grid">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Car size={14} className="text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Toplam Sattığım</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{myStats.total}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Bu Yıl</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{myStats.thisYear}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-success" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Toplam Komisyonum</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-success tabular-nums">{formatCurrency(myStats.totalCommission)}</div>
        </div>
      </div>

      {/* Sattığım araçlar listesi */}
      <div className="bg-card border border-border rounded-xl" data-testid="my-sold-list">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm sm:text-base">Sattığım Araçlar</h3>
          <span className="text-xs text-muted-foreground">{myStats.myCars.length} adet</span>
        </div>
        {myStats.myCars.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground text-sm">Henüz araç satılmadı.</p>
        ) : (
          <div className="divide-y divide-border">
            {myStats.myCars.slice(0, 20).map((c) => {
              const cust = customers?.find((x) => x.id === c.customer_id);
              return (
                <div key={c.id} className="p-3 flex items-center gap-3 hover:bg-muted/30" data-testid={`my-sold-row-${c.id}`}>
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Car size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.brand} {c.model} <span className="text-muted-foreground">({c.year})</span></p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.plate?.toUpperCase()}
                      {cust ? ` · ${cust.name}` : ''}
                      {c.sold_date ? ` · ${new Date(c.sold_date).toLocaleDateString('tr-TR')}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular-nums">{formatCurrency(c.sale_price)}</div>
                    {Number(c.employee_share || 0) > 0 && (
                      <div className="text-[11px] text-success font-semibold tabular-nums">
                        Komisyon: {formatCurrency(c.employee_share)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {myStats.myCars.length > 20 && (
              <p className="p-3 text-center text-xs text-muted-foreground">+ {myStats.myCars.length - 20} daha</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesPersonalView;
