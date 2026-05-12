import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/helpers';
import {
  Car, TrendingUp, Wallet, Package, ShoppingCart, CreditCard, FileText, Calendar,
  BarChart3, PieChart as PieIcon, ArrowUpRight, ArrowDownRight, Filter, Plus,
  Coins, Car as CarIcon, AlertTriangle, Clock, MessageCircle, ArrowRight, Info
} from 'lucide-react';
import CapitalModal from '../components/modals/CapitalModal';
import CapitalDetailModal from '../components/modals/CapitalDetailModal';
import SalesPersonalView from './SalesPersonalView';
import { installmentsAPI } from '../services/api';
import { computeUpcomingPayments, buildPaymentReminderText } from '../utils/installmentReminders';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
// ✅ Refactor: Dashboard alt componentleri ayrı dosyalara çıkarıldı
import { StatCard } from '../components/dashboard/StatCard';
import { CapitalSummaryCard } from '../components/dashboard/CapitalSummaryCard';
import { CustomTooltip } from '../components/dashboard/CustomTooltip';
import { ExpenseBreakdownBar } from '../components/dashboard/ExpenseBreakdownBar';
import { CashFlowVisual } from '../components/dashboard/CashFlowVisual';
import { presets, getDateRange } from '../components/dashboard/dateRange';

const CHART_COLORS = ['#d4a030', '#22c55e', '#ef4444', '#3b82f6', '#a855f7'];
const PIE_COLORS = ['#d4a030', '#f59e0b', '#22c55e', '#3b82f6'];

const Dashboard = ({ onOpenReport }) => {
  const { cars, transactions, loading, capital, user, refreshCapital } = useApp();
  // ✅ 'satis' rolü Sermaye/Kasa modülünü göremez
  const canSeeCapital = (user?.role || 'admin') !== 'satis';
  const isSalesRole = (user?.role || 'admin') === 'satis';


  const [preset, setPreset] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [capitalModalOpen, setCapitalModalOpen] = useState(false);
  const [capitalDetailOpen, setCapitalDetailOpen] = useState(false);

  const dateRange = useMemo(() => {
    if (showCustom && customStart && customEnd) return { start: customStart, end: customEnd };
    return getDateRange(preset);
  }, [preset, showCustom, customStart, customEnd]);

  const activeCars = useMemo(() => cars.filter(c => !c.deleted), [cars]);
  const activeTransactions = useMemo(() => transactions.filter(t => !t.deleted), [transactions]);

  // Filter transactions by date range
  const filteredTx = useMemo(() => {
    return activeTransactions.filter(t => {
      if (!t.date) return false;
      return t.date >= dateRange.start && t.date <= dateRange.end;
    });
  }, [activeTransactions, dateRange]);

  // Filter sold cars by date range
  const filteredSoldCars = useMemo(() => {
    return activeCars.filter(c =>
      c.status === 'Satıldı' && c.sold_date && c.sold_date >= dateRange.start && c.sold_date <= dateRange.end
    );
  }, [activeCars, dateRange]);

  // ---- STATS ----
  const totalIncome = filteredTx.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = filteredTx.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const soldCount = filteredSoldCars.length;

  // ✅ Gider Ayrıştırma: "Stok Yatırımı" (Araç Alımı + Sahibine Ödeme) varlıktır, gider değildir.
  // İşletme Gideri = Toplam Gider − Stok Yatırımı (yani gerçekten cebinden çıkan operasyonel maliyet)
  const stockInvestmentInExpense = useMemo(() => {
    return filteredTx
      .filter(t => t.type === 'expense' && (t.category === 'Araç Alımı' || t.category === 'Araç Sahibine Ödeme'))
      .reduce((s, t) => s + (t.amount || 0), 0);
  }, [filteredTx]);
  const operatingExpense = Math.max(0, totalExpense - stockInvestmentInExpense);

  // ✅ Araç Masraf — sadece ARAÇLARA yapılan gider tx'leri (bakım/onarım/boya/ekspertiz vb.)
  // Alış bedeli (Araç Alımı) ve Sahibine Ödeme HARİÇ — bunlar varlık tarafıdır.
  // Tüm zamanlar (date filter UYGULANMAZ) — sermaye kartı baseline gösterir.
  const vehicleExpensesTotal = useMemo(() => {
    const EXCLUDE = new Set(['Araç Alımı', 'Araç Sahibine Ödeme']);
    return activeTransactions
      .filter(t => t.type === 'expense' && t.car_id && !EXCLUDE.has(t.category))
      .reduce((s, t) => s + (t.amount || 0), 0);
  }, [activeTransactions]);

  // ✅ Net Kâr: Satılan araçlardan elde edilen TOPLAM net kâr (zararlar dahil).
  // Formül: her satılan araç için (sale_price − alış_maliyeti − sahibine_ödeme − araç_giderleri − çalışan_payı)
  // Sermaye değişimi ile uyumlu olması için zararlı satışlar da gerçek değeriyle yansır.
  const netProfit = useMemo(() => {
    return filteredSoldCars.reduce((sum, car) => {
      const salePrice = Number(car.sale_price || 0);
      // Alış maliyeti — stock için purchase_price, consignment için "Araç Sahibine Ödeme" tx
      const purchaseCost = car.ownership === 'stock' ? Number(car.purchase_price || 0) : 0;
      const ownerPay = car.ownership === 'consignment'
        ? activeTransactions
            .filter(t => t.car_id === car.id && t.type === 'expense' && t.category === 'Araç Sahibine Ödeme' && !t.deleted)
            .reduce((s, t) => s + (t.amount || 0), 0)
        : 0;
      // Araç bazlı diğer giderler — Alış (purchaseCost'ta), Sahibine Ödeme (ownerPay'de) ve Kapora İadesi hariç
      const vehicleExpenses = activeTransactions
        .filter(t =>
          t.car_id === car.id &&
          t.type === 'expense' &&
          !t.deleted &&
          t.category !== 'Araç Alımı' &&
          t.category !== 'Araç Sahibine Ödeme' &&
          t.category !== 'Kapora İadesi'
        )
        .reduce((s, t) => s + (t.amount || 0), 0);
      const profit = salePrice - purchaseCost - ownerPay - vehicleExpenses;
      return sum + profit; // Zararlar da düşülür (sermaye ile uyumlu)
    }, 0);
  }, [filteredSoldCars, activeTransactions]);

  // All-time cash
  const allTimeIncome = activeTransactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const allTimeExpense = activeTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const kasaDurumu = allTimeIncome - allTimeExpense;

  const stockCars = activeCars.filter(c => c.ownership === 'stock' && c.status !== 'Satıldı');
  const consignmentCars = activeCars.filter(c => c.ownership === 'consignment' && c.status !== 'Satıldı');
  const depositCars = activeCars.filter(c => c.status === 'Kapora Alındı');

  // Sold cars revenue
  const soldRevenue = useMemo(() => {
    return filteredSoldCars.reduce((sum, c) => sum + (c.sale_price || 0), 0);
  }, [filteredSoldCars]);

  // ---- CHARTS ----

  // Monthly/Weekly bar chart - dynamically grouped by period
  const barChartData = useMemo(() => {
    const startD = new Date(dateRange.start);
    const endD = new Date(dateRange.end);
    const diffDays = Math.ceil((endD - startD) / (1000 * 60 * 60 * 24));
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    if (diffDays <= 14) {
      // Daily grouping
      const data = [];
      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        const label = `${d.getDate()} ${monthNames[d.getMonth()]}`;
        const income = filteredTx.filter(t => t.type === 'income' && t.date === key).reduce((s, t) => s + (t.amount || 0), 0);
        const expense = filteredTx.filter(t => t.type === 'expense' && t.date === key).reduce((s, t) => s + (t.amount || 0), 0);
        data.push({ name: label, Gelir: income, Gider: expense });
      }
      return data;
    } else if (diffDays <= 90) {
      // Weekly grouping
      const data = [];
      let weekStart = new Date(startD);
      let weekNum = 1;
      while (weekStart <= endD) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const wEnd = weekEnd > endD ? endD : weekEnd;
        const wsKey = weekStart.toISOString().split('T')[0];
        const weKey = wEnd.toISOString().split('T')[0];
        const income = filteredTx.filter(t => t.type === 'income' && t.date >= wsKey && t.date <= weKey).reduce((s, t) => s + (t.amount || 0), 0);
        const expense = filteredTx.filter(t => t.type === 'expense' && t.date >= wsKey && t.date <= weKey).reduce((s, t) => s + (t.amount || 0), 0);
        const label = `${weekStart.getDate()} ${monthNames[weekStart.getMonth()]}`;
        data.push({ name: label, Gelir: income, Gider: expense });
        weekStart.setDate(weekStart.getDate() + 7);
        weekNum++;
      }
      return data;
    } else {
      // Monthly grouping
      const data = [];
      let cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
      while (cur <= endD) {
        const monthKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        const label = `${monthNames[cur.getMonth()]}${cur.getFullYear() !== endD.getFullYear() ? ' ' + cur.getFullYear() : ''}`;
        const income = filteredTx.filter(t => t.type === 'income' && t.date?.startsWith(monthKey)).reduce((s, t) => s + (t.amount || 0), 0);
        const expense = filteredTx.filter(t => t.type === 'expense' && t.date?.startsWith(monthKey)).reduce((s, t) => s + (t.amount || 0), 0);
        data.push({ name: label, Gelir: income, Gider: expense });
        cur.setMonth(cur.getMonth() + 1);
      }
      return data;
    }
  }, [filteredTx, dateRange]);

  // Vehicle status pie chart (always all vehicles)
  const vehicleStatusData = useMemo(() => {
    const stokta = activeCars.filter(c => c.status === 'Stokta' && c.ownership === 'stock').length;
    const konsinye = activeCars.filter(c => c.ownership === 'consignment' && c.status !== 'Satıldı').length;
    const satildi = activeCars.filter(c => c.status === 'Satıldı').length;
    const kapora = activeCars.filter(c => c.status === 'Kapora Alındı').length;
    return [
      { name: 'Stokta', value: stokta },
      { name: 'Konsinye', value: konsinye },
      { name: 'Satıldı', value: satildi },
      { name: 'Kapora', value: kapora },
    ].filter(d => d.value > 0);
  }, [activeCars]);

  // Sales trend area chart - filtered by date range
  const salesTrendData = useMemo(() => {
    const startD = new Date(dateRange.start);
    const endD = new Date(dateRange.end);
    const diffDays = Math.ceil((endD - startD) / (1000 * 60 * 60 * 24));
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    if (diffDays <= 31) {
      // Daily
      const data = [];
      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        const count = filteredSoldCars.filter(c => c.sold_date === key).length;
        data.push({ name: `${d.getDate()}/${d.getMonth() + 1}`, Satış: count });
      }
      return data;
    } else {
      // Monthly
      const data = [];
      let cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
      while (cur <= endD) {
        const monthKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        const count = activeCars.filter(c =>
          c.status === 'Satıldı' && c.sold_date?.startsWith(monthKey) && c.sold_date >= dateRange.start && c.sold_date <= dateRange.end
        ).length;
        data.push({ name: `${monthNames[cur.getMonth()]}`, Satış: count });
        cur.setMonth(cur.getMonth() + 1);
      }
      return data;
    }
  }, [activeCars, filteredSoldCars, dateRange]);

  // Top selling brands in period
  const topBrandsData = useMemo(() => {
    const brandCount = {};
    filteredSoldCars.forEach(c => { brandCount[c.brand] = (brandCount[c.brand] || 0) + 1; });
    const result = Object.entries(brandCount).map(([brand, count]) => ({ brand, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    if (result.length === 0) {
      activeCars.forEach(c => { brandCount[c.brand] = (brandCount[c.brand] || 0) + 1; });
      return Object.entries(brandCount).map(([brand, count]) => ({ brand, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    }
    return result;
  }, [filteredSoldCars, activeCars]);

  // Top sellers (sold_by_name) in period
  const topSellers = useMemo(() => {
    const sellerCount = {};
    filteredSoldCars.forEach(c => {
      const name = c.sold_by_name || 'Belirtilmemiş';
      sellerCount[name] = (sellerCount[name] || 0) + 1;
    });
    return Object.entries(sellerCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filteredSoldCars]);

  // Recent transactions (in period)
  const recentTx = useMemo(() => {
    return [...filteredTx].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  }, [filteredTx]);

  // Category breakdown for period
  const categoryBreakdown = useMemo(() => {
    const cats = {};
    filteredTx.forEach(t => {
      const key = t.category || 'Diğer';
      if (!cats[key]) cats[key] = { income: 0, expense: 0 };
      if (t.type === 'income') cats[key].income += t.amount || 0;
      else cats[key].expense += t.amount || 0;
    });
    return Object.entries(cats)
      .map(([cat, v]) => ({ category: cat, ...v, total: v.income + v.expense }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [filteredTx]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const presetLabel = presets.find(p => p.id === preset)?.label || '';

  // ✅ 'satis' rolündeki kullanıcı için kişiselleştirilmiş satış görünümü
  if (isSalesRole) {
    return <SalesPersonalView />;
  }

  return (
    <div className="space-y-5 pb-24 md:pb-6 animate-fade-in" data-testid="dashboard">
      {/* ✅ Toplam Sermaye (Nakit + Araç Envanteri) Kartı — sadece admin/muhasebe */}
      {canSeeCapital && (
        <CapitalSummaryCard
          cars={cars}
          cashAmount={Number(capital?.amount || 0)}
          foundingCapital={Number(capital?.founding_capital || 0)}
          netProfit={netProfit}
          vehicleExpenses={vehicleExpensesTotal}
          onOpenDetail={() => setCapitalDetailOpen(true)}
          onOpenAction={() => setCapitalModalOpen(true)}
          onFoundingUpdated={refreshCapital}
        />
      )}

      {canSeeCapital && (
        <>
          <CapitalModal isOpen={capitalModalOpen} onClose={() => setCapitalModalOpen(false)} />
          <CapitalDetailModal isOpen={capitalDetailOpen} onClose={() => setCapitalDetailOpen(false)} />
        </>
      )}

      {/* ✅ Vade Hatırlatıcı + Ciro Karşılaştırma — finansal, satış görmez */}
      <PaymentRemindersBar />
      {canSeeCapital && <RevenueComparisonCard transactions={activeTransactions} />}

      {/* Date Range Filter */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4" data-testid="date-filter">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-primary" />
          <span className="text-sm font-semibold">Tarih Aralığı</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {presets.map(p => (
            <button
              key={p.id}
              onClick={() => { setPreset(p.id); setShowCustom(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                preset === p.id && !showCustom
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
              data-testid={`preset-${p.id}`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => {
              setShowCustom(true);
              if (!customStart) setCustomStart(dateRange.start);
              if (!customEnd) setCustomEnd(dateRange.end);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              showCustom
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
            data-testid="preset-custom"
          >
            Özel
          </button>
        </div>
        {showCustom && (
          <div className="flex items-center gap-2 mt-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="h-8 px-2 bg-background border border-border rounded-lg text-xs flex-1" data-testid="custom-start" />
            <span className="text-muted-foreground text-xs">-</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="h-8 px-2 bg-background border border-border rounded-lg text-xs flex-1" data-testid="custom-end" />
          </div>
        )}
      </div>

      {/* Stats Grid — finansal kartlar (Gelir/Gider/Kâr) sadece admin/muhasebe görebilir */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {canSeeCapital && <StatCard title="TOPLAM GELİR" value={formatCurrency(totalIncome)} icon={ArrowUpRight} color="success" />}
        {canSeeCapital && (
          <StatCard
            title="TOPLAM GİDER"
            value={formatCurrency(totalExpense)}
            icon={ArrowDownRight}
            color="destructive"
            subtitle={stockInvestmentInExpense > 0 ? `${formatCurrency(stockInvestmentInExpense)} stok yatırımı` : undefined}
            tooltip="Bu rakam araç alış maliyetlerini de içerir. Alış bedelleri 'gider' değil stoktaki araçlarda duran VARLIKTIR — kasanızdan çıkmadı, sadece nakit → araç olarak şekil değiştirdi."
          />
        )}
        {canSeeCapital && (
          <StatCard
            title="NET KÂR"
            value={formatCurrency(netProfit)}
            icon={TrendingUp}
            color="success"
            subtitle="Sadece satılan araçlardan"
            tooltip="Net Kâr ≠ Kasadaki Nakit. Kâr, yalnızca SATIŞI tamamlanmış araçlardan hesaplanır. Kasanızdaki nakit miktarı stoktaki araçlara yapılan yatırımı da yansıtır — bu yüzden ikisi nadiren eşittir."
          />
        )}
        <StatCard title="SATILAN ARAÇ" value={soldCount} icon={ShoppingCart} color="primary" subtitle={soldRevenue > 0 ? formatCurrency(soldRevenue) : undefined} />
        <StatCard title="STOK / KONSİNYE" value={`${stockCars.length} / ${consignmentCars.length}`} icon={Package} color="default" subtitle={`${depositCars.length} kapora`} />
      </div>

      {/* ✅ Gider Analizi — Stok Yatırımı (Varlık) vs İşletme Gideri ayrımı */}
      {canSeeCapital && (
        <ExpenseBreakdownBar
          totalExpense={totalExpense}
          stockInvestmentInExpense={stockInvestmentInExpense}
          operatingExpense={operatingExpense}
        />
      )}

      {/* ✅ Dönem Nakit Akışı — Kâr ≠ Kasa farkını görselleştirir */}
      {canSeeCapital && (
        <CashFlowVisual
          totalIncome={totalIncome}
          stockInvestmentInExpense={stockInvestmentInExpense}
          operatingExpense={operatingExpense}
          netProfit={netProfit}
        />
      )}

      {/* Charts Row 1: Bar + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Income/Expense Bar Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 sm:p-5" data-testid="monthly-chart">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" />
              <h3 className="font-heading font-semibold text-sm sm:text-base">Gelir / Gider</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-green-500" /><span className="text-[10px] text-muted-foreground">Gelir</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-500" /><span className="text-[10px] text-muted-foreground">Gider</span></div>
            </div>
          </div>
          <div className="h-56 sm:h-64">
            {barChartData.some(d => d.Gelir > 0 || d.Gider > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(0 0% 55%)', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(0 0% 12%)' }} />
                  <Bar dataKey="Gelir" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Gider" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Bu dönemde işlem yok</div>
            )}
          </div>
        </div>

        {/* Vehicle Status Pie */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5" data-testid="status-chart">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon size={18} className="text-primary" />
            <h3 className="font-heading font-semibold text-sm sm:text-base">Araç Dağılımı</h3>
          </div>
          {vehicleStatusData.length > 0 ? (
            <>
              <div className="h-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={vehicleStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value" stroke="none">
                      {vehicleStatusData.map((entry, i) => (<Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v} araç`, name]}
                      contentStyle={{ background: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 16%)', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: 'hsl(0 0% 95%)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {vehicleStatusData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                    <span className="text-xs font-bold ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">Araç yok</div>
          )}
        </div>
      </div>

      {/* Charts Row 2: Sales Trend + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sales Trend */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 sm:p-5" data-testid="sales-trend-chart">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-green-500" />
            <h3 className="font-heading font-semibold text-sm sm:text-base">Satış Trendi</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">{soldCount} araç satıldı</span>
          </div>
          <div className="h-44 sm:h-48">
            {salesTrendData.some(d => d.Satış > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrendData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(0 0% 55%)', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Satış" stroke="#22c55e" fill="url(#salesGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Bu dönemde satış yok</div>
            )}
          </div>
        </div>

        {/* Category Breakdown — sadece admin/muhasebe */}
        {canSeeCapital && (
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5" data-testid="category-breakdown">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={18} className="text-primary" />
              <h3 className="font-heading font-semibold text-sm sm:text-base">Kategori Dağılımı</h3>
            </div>
          {categoryBreakdown.length > 0 ? (
            <div className="space-y-2.5">
              {categoryBreakdown.map((item, i) => (
                <div key={item.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground truncate max-w-[60%]">{item.category}</span>
                    <div className="flex gap-2">
                      {item.income > 0 && <span className="text-success">+{formatCurrency(item.income)}</span>}
                      {item.expense > 0 && <span className="text-destructive">-{formatCurrency(item.expense)}</span>}
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
                    {item.income > 0 && <div className="h-full bg-green-500" style={{ width: `${(item.income / (item.income + item.expense)) * 100}%` }} />}
                    {item.expense > 0 && <div className="h-full bg-red-500" style={{ width: `${(item.expense / (item.income + item.expense)) * 100}%` }} />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Bu dönemde işlem yok</div>
          )}
          </div>
        )}
      </div>

      {/* Row 3: Top Brands + Top Sellers + Recent Transactions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Top Brands */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5" data-testid="top-brands">
          <div className="flex items-center gap-2 mb-4">
            <Car size={18} className="text-primary" />
            <h3 className="font-heading font-semibold text-sm sm:text-base">En Çok Satan Markalar</h3>
          </div>
          {topBrandsData.length > 0 ? (
            <div className="space-y-3">
              {topBrandsData.map((item, i) => {
                const maxCount = topBrandsData[0]?.count || 1;
                const pct = (item.count / maxCount) * 100;
                return (
                  <div key={item.brand}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{i + 1}. {item.brand}</span>
                      <span className="text-muted-foreground text-xs">{item.count} araç</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">Veri yok</div>
          )}
        </div>

        {/* Top Sellers */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5" data-testid="top-sellers">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={18} className="text-success" />
            <h3 className="font-heading font-semibold text-sm sm:text-base">Satış Elemanları</h3>
          </div>
          {topSellers.length > 0 ? (
            <div className="space-y-3">
              {topSellers.map((item, i) => {
                const maxCount = topSellers[0]?.count || 1;
                const pct = (item.count / maxCount) * 100;
                return (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{i + 1}. {item.name}</span>
                      <span className="text-muted-foreground text-xs">{item.count} satış</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-success" style={{ width: `${pct}%`, opacity: 1 - (i * 0.15) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">Bu dönemde satış yok</div>
          )}
        </div>

        {/* Recent Transactions — sadece admin/muhasebe */}
        {canSeeCapital && (
          <div className="bg-card border border-border rounded-xl" data-testid="recent-transactions">
            <div className="p-4 border-b border-border">
              <h3 className="font-heading font-semibold text-sm sm:text-base">Son İşlemler</h3>
            </div>
            <div className="p-2">
              {recentTx.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">Bu dönemde işlem yok</p>
              ) : (
                recentTx.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{tx.category}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{tx.description}</p>
                    </div>
                    <span className={`font-heading font-bold text-xs tabular-nums ml-2 ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reports Button — sadece admin/muhasebe */}
      {canSeeCapital && (
      <button
        onClick={onOpenReport}
        className="w-full p-4 bg-card border border-border rounded-xl flex items-center justify-between hover:bg-muted/50 transition-colors"
        data-testid="open-reports-btn"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <FileText size={24} className="text-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">Detaylı Raporlar</p>
            <p className="text-xs text-muted-foreground">Yazdırılabilir finansal raporlar</p>
          </div>
        </div>
        <Calendar size={20} className="text-muted-foreground" />
      </button>
      )}
    </div>
  );
};

export default Dashboard;

// ✅ Vade Hatırlatıcı Bar — yaklaşan/geciken taksitleri üstte gösterir
const PaymentRemindersBar = () => {
  const { customers } = useApp();
  const [items, setItems] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let alive = true;
    installmentsAPI.list()
      .then(res => {
        if (!alive) return;
        const inst = res.data || [];
        setItems(computeUpcomingPayments(inst, { daysAhead: 7 }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (items.length === 0) return null;

  const sendWA = (item) => {
    const customer = customers.find(c => c.id === item.customer_id);
    const phone = (customer?.phone || '').replace(/\D/g, '');
    const text = encodeURIComponent(buildPaymentReminderText(item));
    const url = phone ? `https://wa.me/${phone.startsWith('90') ? phone : '90' + phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const overdue = items.filter(i => i.status === 'overdue').length;
  const upcoming = items.filter(i => i.status === 'upcoming').length;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden" data-testid="payment-reminders">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-amber-500/10 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle size={20} className="text-amber-500 shrink-0" />
          <div className="text-left">
            <div className="font-semibold text-sm">
              {overdue > 0 && <span className="text-destructive">{overdue} geciken</span>}
              {overdue > 0 && upcoming > 0 && ', '}
              {upcoming > 0 && <span className="text-amber-500">{upcoming} yaklaşan</span>} taksit
            </div>
            <div className="text-xs text-muted-foreground">Hatırlatma metni hazır — tek tıkla gönder</div>
          </div>
        </div>
        <ArrowRight size={18} className={`text-muted-foreground transition-transform ${collapsed ? '' : 'rotate-90'}`} />
      </button>
      {!collapsed && (
        <div className="border-t border-amber-500/20 divide-y divide-border">
          {items.map(item => {
            const isOverdue = item.status === 'overdue';
            return (
              <div
                key={`${item.installment_id}-${item.term_index}`}
                className="flex items-center justify-between gap-3 p-3 text-sm"
                data-testid={`reminder-${item.installment_id}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isOverdue ? (
                    <AlertTriangle size={16} className="text-destructive shrink-0" />
                  ) : (
                    <Clock size={16} className="text-amber-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{item.customer_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.term_index}. taksit · {new Date(item.due_date).toLocaleDateString('tr-TR')} ·
                      <span className={`ml-1 font-semibold ${isOverdue ? 'text-destructive' : 'text-amber-500'}`}>
                        {isOverdue ? `${Math.abs(item.days_diff)} gün gecikme` : `${item.days_diff} gün sonra`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm">{formatCurrency(item.amount)}</span>
                  <button
                    type="button"
                    onClick={() => sendWA(item)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors"
                    data-testid={`send-reminder-${item.installment_id}`}
                  >
                    <MessageCircle size={13} /> Gönder
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ✅ Ciro Karşılaştırma Kartı (Bu Ay vs Geçen Ay vs Geçen Yıl Aynı Ay)
const RevenueComparisonCard = ({ transactions }) => {
  const data = useMemo(() => {
    const sumIncome = (start, end) =>
      transactions
        .filter(t => t.type === 'income' && t.date >= start && t.date <= end)
        .reduce((s, t) => s + (t.amount || 0), 0);

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const fmt = (d) => d.toISOString().split('T')[0];
    const monthRange = (year, month) => {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { start: fmt(start), end: fmt(end) };
    };

    const thisMonth = monthRange(y, m);
    const lastMonth = monthRange(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1);
    const lastYearSame = monthRange(y - 1, m);

    const a = sumIncome(thisMonth.start, thisMonth.end);
    const b = sumIncome(lastMonth.start, lastMonth.end);
    const c = sumIncome(lastYearSame.start, lastYearSame.end);

    const pct = (cur, ref) => (ref > 0 ? ((cur - ref) / ref) * 100 : (cur > 0 ? 100 : 0));

    return {
      thisMonth: a,
      lastMonth: b,
      lastYearSame: c,
      vsLastMonth: pct(a, b),
      vsLastYear: pct(a, c),
    };
  }, [transactions]);

  const Stat = ({ label, value, comparison, comparisonLabel }) => {
    const positive = comparison > 0;
    const negative = comparison < 0;
    return (
      <div className="flex-1 rounded-xl border border-border bg-card/40 p-3.5 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="mt-1 text-lg sm:text-xl font-extrabold tabular-nums truncate">{formatCurrency(value)}</div>
        {comparisonLabel && (
          <div className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${positive ? 'text-success' : negative ? 'text-destructive' : 'text-muted-foreground'}`}>
            {positive ? <ArrowUpRight size={13} /> : negative ? <ArrowDownRight size={13} /> : null}
            <span>{Math.abs(comparison).toFixed(1)}%</span>
            <span className="text-muted-foreground font-normal">vs {comparisonLabel}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5" data-testid="revenue-comparison">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={18} className="text-primary" />
        <h3 className="font-heading font-semibold text-base">Ciro Karşılaştırma</h3>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Stat label="Bu Ay" value={data.thisMonth} comparison={data.vsLastMonth} comparisonLabel="geçen ay" />
        <Stat label="Geçen Ay" value={data.lastMonth} />
        <Stat label="Geçen Yıl Aynı Ay" value={data.lastYearSame} comparison={data.vsLastYear} comparisonLabel="geçen yıl" />
      </div>
    </div>
  );
};
