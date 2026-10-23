import React, { useEffect, useState } from 'react';
import { TrendingUp, Award, Users, RefreshCcw, BarChart3 } from 'lucide-react';
import { statsAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const currentYear = new Date().getFullYear();

const EmployeePerformancePage = () => {
  const [data, setData] = useState({ performance: [], totals: null });
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState({ period: 'monthly', year: currentYear, data: [] });
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await statsAPI.employeePerformance();
      setData({
        performance: res.data?.performance || [],
        totals: res.data?.totals || null,
      });
    } catch {
      toast.error('Performans verisi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  const loadBreakdown = async (period, year) => {
    setBreakdownLoading(true);
    try {
      const res = await statsAPI.salesBreakdown(period, period === 'monthly' ? year : undefined);
      setBreakdown({
        period,
        year: res.data?.year || year,
        data: res.data?.data || [],
      });
    } catch {
      toast.error('Grafik verisi alınamadı');
    } finally {
      setBreakdownLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadBreakdown(breakdown.period, breakdown.year); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [breakdown.period, breakdown.year]);

  const top = data.performance[0];
  const activeEmployees = data.performance.filter(p => p.sold_count > 0);

  return (
    <div className="space-y-6" data-testid="employee-performance-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <TrendingUp size={22} className="text-primary" />
            Personel Performansı
          </h2>
          <p className="text-sm text-muted-foreground">
            Her personelin sattığı araç sayısı, toplam ciro ve net kâr katkısı.
          </p>
        </div>
        <button
          onClick={load}
          className="h-10 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          data-testid="perf-refresh-btn"
        >
          <RefreshCcw size={16} /> Yenile
        </button>
      </div>

      {/* Özet kartları */}
      {data.totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 border border-border rounded-xl bg-card" data-testid="perf-summary-sold">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Toplam Satış</div>
            <div className="text-2xl font-bold">{data.totals.sold_count}</div>
          </div>
          <div className="p-4 border border-border rounded-xl bg-card">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Toplam Ciro</div>
            <div className="text-xl font-bold text-success">{formatCurrency(data.totals.total_revenue)}</div>
          </div>
          <div className="p-4 border border-border rounded-xl bg-card">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Toplam Kâr</div>
            <div className={`text-xl font-bold ${data.totals.total_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(data.totals.total_profit)}
            </div>
            {data.totals.sold_count > 0 && (
              <div className={`text-[11px] mt-1 font-medium ${data.totals.avg_profit >= 0 ? 'text-success/80' : 'text-destructive/80'}`} data-testid="perf-totals-avg-profit">
                Ort: {formatCurrency(data.totals.avg_profit)} / satış
              </div>
            )}
          </div>
          <div className="p-4 border border-border rounded-xl bg-card">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Aktif Personel</div>
            <div className="text-2xl font-bold flex items-center gap-1.5">
              <Users size={18} className="text-muted-foreground" />
              {activeEmployees.length}
            </div>
          </div>
        </div>
      )}

      {/* En iyi performans */}
      {top && top.sold_count > 0 && (
        <div className="p-5 border-2 border-primary/40 bg-primary/5 rounded-xl flex items-center gap-4" data-testid="perf-top-seller">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Award size={28} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">En İyi Satıcı</div>
            <div className="text-lg font-bold truncate">{top.user_name}</div>
            <div className="text-sm text-muted-foreground">
              {top.sold_count} araç • Kâr katkısı:{' '}
              <span className={top.total_profit >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                {formatCurrency(top.total_profit)}
              </span>
              {top.sold_count > 0 && (
                <>
                  {' • '}
                  <span className="text-xs">Ort: <span className={`font-semibold ${top.avg_profit >= 0 ? 'text-success' : 'text-destructive'}`} data-testid="perf-top-avg-profit">{formatCurrency(top.avg_profit)}</span> / satış</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Aylık / Yıllık Breakdown Chart */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6" data-testid="perf-breakdown-chart">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 size={18} className="text-primary" />
            Satış & Kâr Kırılımı
            <span className="text-xs text-muted-foreground font-normal">
              ({breakdown.period === 'monthly' ? `${breakdown.year} yılı aylık` : 'Son 5 yıl'})
            </span>
          </h3>
          <div className="flex gap-2 items-center">
            <div className="inline-flex rounded-lg border border-border overflow-hidden" data-testid="perf-period-switch">
              <button
                onClick={() => setBreakdown(b => ({ ...b, period: 'monthly' }))}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  breakdown.period === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted text-foreground'
                }`}
                data-testid="perf-period-monthly"
              >
                Aylık
              </button>
              <button
                onClick={() => setBreakdown(b => ({ ...b, period: 'yearly' }))}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  breakdown.period === 'yearly' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted text-foreground'
                }`}
                data-testid="perf-period-yearly"
              >
                Yıllık
              </button>
            </div>
            {breakdown.period === 'monthly' && (
              <select
                value={breakdown.year}
                onChange={(e) => setBreakdown(b => ({ ...b, year: Number(e.target.value) }))}
                className="h-8 px-2 bg-background border border-border rounded-lg text-xs font-semibold"
                data-testid="perf-year-select"
              >
                {Array.from({ length: 6 }, (_, i) => currentYear - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="h-64">
          {breakdownLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Yükleniyor…</div>
          ) : breakdown.data.length === 0 || breakdown.data.every(d => d.sold_count === 0) ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Bu dönemde satış kaydı yok.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown.data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="count" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <YAxis yAxisId="profit" orientation="right" tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(value, name) => {
                    if (name === 'Satış Adedi') return [value, name];
                    return [formatCurrency(value), name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar yAxisId="count" dataKey="sold_count" name="Satış Adedi" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="profit" dataKey="profit" name="Net Kâr" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Yükleniyor…</div>
        ) : activeEmployees.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Henüz satış kaydı bulunmuyor. Bir araç satıldığında otomatik olarak buraya yansır.
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-border">
              {data.performance.map((p, idx) => (
                <div key={p.user_id || `unassigned-${idx}`} className="p-3" data-testid={`perf-row-${p.user_id || 'none'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{p.user_name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">
                        {p.role || 'atanmamış'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold">{p.sold_count} araç</div>
                      <div className={`text-sm font-semibold ${p.total_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(p.total_profit)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1 mt-1">
                    <span>Ciro: <span className="text-success font-medium">{formatCurrency(p.total_revenue)}</span></span>
                    <span>Maliyet: <span className="text-destructive font-medium">{formatCurrency(p.total_cost)}</span></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]" data-testid="perf-table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Sıra</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Personel</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Rol</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Satış Adedi</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Toplam Ciro</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Toplam Maliyet</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Çalışan Payı</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Net Kâr</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Ort/Satış</th>
                  </tr>
                </thead>
                <tbody>
                  {data.performance.map((p, idx) => (
                    <tr key={p.user_id || `unassigned-${idx}`} className="border-b border-border hover:bg-muted/20" data-testid={`perf-row-${p.user_id || 'none'}`}>
                      <td className="p-3 text-sm tabular-nums">
                        {idx === 0 && p.sold_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-primary font-bold">
                            <Award size={14} /> 1
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{idx + 1}</span>
                        )}
                      </td>
                      <td className="p-3 text-sm font-semibold">{p.user_name}</td>
                      <td className="p-3 text-xs text-muted-foreground uppercase">
                        {p.role || '-'}
                      </td>
                      <td className="p-3 text-sm text-center font-bold tabular-nums">{p.sold_count}</td>
                      <td className="p-3 text-sm text-right tabular-nums text-success">{formatCurrency(p.total_revenue)}</td>
                      <td className="p-3 text-sm text-right tabular-nums text-destructive">{formatCurrency(p.total_cost)}</td>
                      <td className="p-3 text-sm text-right tabular-nums">{formatCurrency(p.total_employee_share)}</td>
                      <td className={`p-3 text-sm text-right tabular-nums font-bold ${p.total_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {p.total_profit >= 0 ? '+' : ''}{formatCurrency(p.total_profit)}
                      </td>
                      <td className={`p-3 text-sm text-right tabular-nums ${p.sold_count === 0 ? 'text-muted-foreground' : (p.avg_profit >= 0 ? 'text-success' : 'text-destructive')}`}>
                        {p.sold_count > 0 ? formatCurrency(p.avg_profit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {data.totals && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-bold">
                      <td colSpan={3} className="p-3 text-sm">TOPLAM</td>
                      <td className="p-3 text-sm text-center tabular-nums">{data.totals.sold_count}</td>
                      <td className="p-3 text-sm text-right tabular-nums text-success">{formatCurrency(data.totals.total_revenue)}</td>
                      <td className="p-3 text-sm text-right tabular-nums text-destructive">{formatCurrency(data.totals.total_cost)}</td>
                      <td className="p-3 text-sm text-right tabular-nums">{formatCurrency(data.totals.total_employee_share)}</td>
                      <td className={`p-3 text-sm text-right tabular-nums ${data.totals.total_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(data.totals.total_profit)}
                      </td>
                      <td className={`p-3 text-sm text-right tabular-nums ${data.totals.avg_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {data.totals.sold_count > 0 ? formatCurrency(data.totals.avg_profit) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmployeePerformancePage;
