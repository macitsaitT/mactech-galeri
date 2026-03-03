import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/helpers';
import { 
  Car, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Package,
  ShoppingCart,
  CreditCard,
  FileText,
  Calendar,
  BarChart3,
  PieChart as PieIcon
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
  LineChart, Line, AreaChart, Area
} from 'recharts';

const StatCard = ({ title, value, icon: Icon, color = 'default', className = '' }) => {
  const colorClasses = {
    default: 'bg-card border-border',
    primary: 'bg-primary/10 border-primary/30',
    success: 'bg-success/10 border-success/30',
    warning: 'bg-warning/10 border-warning/30',
    destructive: 'bg-destructive/10 border-destructive/30',
  };
  const iconColors = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
  };

  return (
    <div 
      className={`border rounded-xl p-4 ${colorClasses[color]} ${className}`}
      data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1 truncate">{title}</p>
          <p className="font-heading font-bold text-lg sm:text-2xl tabular-nums truncate">{value}</p>
        </div>
        <div className={`p-2 sm:p-3 rounded-lg bg-background/50 ${iconColors[color]}`}>
          <Icon size={20} className="sm:w-6 sm:h-6" />
        </div>
      </div>
    </div>
  );
};

const StockStatusItem = ({ car }) => (
  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm truncate">{car.brand} {car.model} {car.vehicle_type}</p>
      <p className="text-xs text-muted-foreground">{car.plate?.toUpperCase()} - {car.year}</p>
    </div>
    <span className={`px-3 py-1 text-xs font-bold rounded-full ${
      car.status === 'Stokta' ? 'bg-primary/20 text-primary' :
      car.status === 'Kapora Alındı' ? 'bg-warning/20 text-warning' :
      'bg-success/20 text-success'
    }`}>
      {car.status === 'Stokta' ? 'Stokta' : car.status === 'Kapora Alındı' ? 'Kapora' : 'Satıldı'}
    </span>
  </div>
);

const TransactionItem = ({ transaction }) => {
  const isIncome = transaction.type === 'income';
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{transaction.category}</p>
        <p className="text-xs text-muted-foreground truncate">{transaction.description}</p>
      </div>
      <span className={`font-heading font-bold tabular-nums ${isIncome ? 'text-success' : 'text-destructive'}`}>
        {isIncome ? '+' : '-'}{formatCurrency(transaction.amount).replace('₺', '')}
      </span>
    </div>
  );
};

const CHART_COLORS = ['#d4a030', '#22c55e', '#ef4444', '#3b82f6', '#a855f7'];
const PIE_COLORS = ['#d4a030', '#f59e0b', '#22c55e', '#3b82f6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

const Dashboard = ({ onOpenReport }) => {
  const { stats, cars, transactions, loading } = useApp();

  const activeCars = cars.filter(c => !c.deleted);
  const activeTransactions = transactions.filter(t => !t.deleted);

  const stockCars = activeCars.filter(c => c.ownership === 'stock' && c.status !== 'Satıldı');
  const consignmentCars = activeCars.filter(c => c.ownership === 'consignment' && c.status !== 'Satıldı');
  const depositCars = activeCars.filter(c => c.status === 'Kapora Alındı');
  
  const now = useMemo(() => new Date(), []);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthSales = activeCars.filter(c => 
    c.status === 'Satıldı' && c.sold_date && new Date(c.sold_date) >= thisMonthStart
  ).length;

  const totalIncome = activeTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = activeTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
  const kasaDurumu = totalIncome - totalExpense;

  const recentTransactions = [...activeTransactions]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  const stockStatusCars = [...activeCars]
    .filter(c => c.status !== 'Satıldı')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  // Monthly income/expense chart data (last 6 months)
  const monthlyData = useMemo(() => {
    const months = [];
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${monthNames[d.getMonth()]} ${d.getFullYear() !== now.getFullYear() ? d.getFullYear() : ''}`.trim();
      
      const monthIncome = activeTransactions
        .filter(t => t.type === 'income' && t.date?.startsWith(monthKey))
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      const monthExpense = activeTransactions
        .filter(t => t.type === 'expense' && t.date?.startsWith(monthKey))
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      months.push({ name: monthLabel, Gelir: monthIncome, Gider: monthExpense });
    }
    return months;
  }, [activeTransactions, now]);

  // Vehicle status pie chart data
  const vehicleStatusData = useMemo(() => {
    const stokta = activeCars.filter(c => c.status === 'Stokta').length;
    const kapora = activeCars.filter(c => c.status === 'Kapora Alındı').length;
    const satildi = activeCars.filter(c => c.status === 'Satıldı').length;
    const konsinye = activeCars.filter(c => c.ownership === 'consignment' && c.status !== 'Satıldı').length;
    
    return [
      { name: 'Stokta', value: stokta },
      { name: 'Konsinye', value: konsinye },
      { name: 'Satıldı', value: satildi },
      { name: 'Kapora', value: kapora },
    ].filter(d => d.value > 0);
  }, [activeCars]);

  // Sales trend (last 30 days)
  const salesTrendData = useMemo(() => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const daySales = activeCars.filter(c =>
        c.status === 'Satıldı' && c.sold_date && c.sold_date.startsWith(dateStr)
      ).length;
      const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
      data.push({ name: dayLabel, Satış: daySales });
    }
    return data;
  }, [activeCars]);

  // Top brands
  const topBrandsData = useMemo(() => {
    const brandCount = {};
    activeCars.filter(c => c.status === 'Satıldı').forEach(c => {
      brandCount[c.brand] = (brandCount[c.brand] || 0) + 1;
    });
    const all = Object.entries(brandCount)
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    // If no sold cars, show stock brands
    if (all.length === 0) {
      activeCars.forEach(c => {
        brandCount[c.brand] = (brandCount[c.brand] || 0) + 1;
      });
      return Object.entries(brandCount)
        .map(([brand, count]) => ({ brand, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }
    return all;
  }, [activeCars]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="STOK ARAÇ SAYISI" value={stockCars.length} icon={Car} color="default" />
        <StatCard title="KONSİNYE ARAÇ SAYISI" value={consignmentCars.length} icon={Package} color="default" />
        <StatCard title="KAPORASI ALINAN" value={depositCars.length} icon={CreditCard} color="warning" />
        <StatCard title="BU AY SATIŞ" value={thisMonthSales} icon={ShoppingCart} color="success" />
        <StatCard
          title="KASA DURUMU"
          value={formatCurrency(kasaDurumu)}
          icon={Wallet}
          color={kasaDurumu >= 0 ? 'success' : 'destructive'}
          className="col-span-2 md:col-span-1"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Income/Expense Bar Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5" data-testid="monthly-chart">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-primary" />
            <h3 className="font-heading font-semibold">Aylık Gelir / Gider</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(0 0% 55%)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(0 0% 55%)', fontSize: 11 }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(0 0% 16%)' }} />
                <Bar dataKey="Gelir" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Gider" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-6 mt-3 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              <span className="text-xs text-muted-foreground">Gelir</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-red-500" />
              <span className="text-xs text-muted-foreground">Gider</span>
            </div>
          </div>
        </div>

        {/* Vehicle Status Pie Chart */}
        <div className="bg-card border border-border rounded-xl p-5" data-testid="status-chart">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon size={18} className="text-primary" />
            <h3 className="font-heading font-semibold">Araç Dağılımı</h3>
          </div>
          {vehicleStatusData.length > 0 ? (
            <>
              <div className="h-48 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={vehicleStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {vehicleStatusData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value} araç`, name]}
                      contentStyle={{ background: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 16%)', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: 'hsl(0 0% 95%)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {vehicleStatusData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                    <span className="text-xs font-bold ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Henüz araç eklenmemiş</p>
            </div>
          )}
        </div>
      </div>

      {/* Content Grid - Son İşlemler & Stok Durumu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h3 className="font-heading font-semibold text-lg">Son İşlemler</h3>
          </div>
          <div className="p-2">
            {recentTransactions.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Henüz işlem yok</p>
            ) : (
              recentTransactions.map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} />
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h3 className="font-heading font-semibold text-lg">Stok Durumu</h3>
          </div>
          <div className="p-2">
            {stockStatusCars.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Henüz araç eklenmemiş</p>
            ) : (
              stockStatusCars.map((car) => (
                <StockStatusItem key={car.id} car={car} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sales Trend + Top Brands */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend - Area Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5" data-testid="sales-trend-chart">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-green-500" />
            <h3 className="font-heading font-semibold">Son 30 Gün Satış Trendi</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrendData}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} interval={4} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(0 0% 55%)', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Satış" stroke="#22c55e" fill="url(#salesGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Brands */}
        <div className="bg-card border border-border rounded-xl p-5" data-testid="top-brands">
          <div className="flex items-center gap-2 mb-4">
            <Car size={18} className="text-primary" />
            <h3 className="font-heading font-semibold">Marka Sıralaması</h3>
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
                      <span className="text-muted-foreground">{item.count} araç</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: CHART_COLORS[i % CHART_COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz veri yok</p>
          )}
        </div>
      </div>

      {/* Reports Button */}
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
            <p className="font-semibold">Raporlar</p>
            <p className="text-sm text-muted-foreground">Finansal raporlar ve döküm oluştur</p>
          </div>
        </div>
        <Calendar size={20} className="text-muted-foreground" />
      </button>
    </div>
  );
};

export default Dashboard;
