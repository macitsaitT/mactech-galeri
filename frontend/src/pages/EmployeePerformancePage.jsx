import React, { useEffect, useState } from 'react';
import { TrendingUp, Award, Users, RefreshCcw } from 'lucide-react';
import { statsAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { toast } from 'sonner';

const EmployeePerformancePage = () => {
  const [data, setData] = useState({ performance: [], totals: null });
  const [loading, setLoading] = useState(false);

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

  useEffect(() => { load(); }, []);

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
            </div>
          </div>
        </div>
      )}

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
