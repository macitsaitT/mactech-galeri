import React, { useEffect, useState } from 'react';
import { Package, AlertTriangle, RefreshCcw, TrendingUp } from 'lucide-react';
import { statsAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { toast } from 'sonner';

const StockAgingPage = () => {
  const [data, setData] = useState({ rows: [], buckets: null, totals: null });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await statsAPI.stockAging();
      setData({ rows: res.data?.rows || [], buckets: res.data?.buckets, totals: res.data?.totals });
    } catch {
      toast.error('Stok yaşlanma bilgisi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const bucketColor = (days) => {
    if (days > 90) return 'bg-destructive/25 text-destructive border-destructive/40';
    if (days > 60) return 'bg-amber-500/25 text-amber-600 border-amber-500/40';
    if (days > 30) return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
    return 'bg-success/20 text-success border-success/30';
  };

  return (
    <div className="space-y-4" data-testid="stock-aging-page">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Package size={22} className="text-primary" />
            Stok Yaşlanma Analizi
          </h2>
          <p className="text-sm text-muted-foreground">
            Stokta uzun süre kalan araçlar için günlük sermaye maliyeti ve revize önerisi.
          </p>
        </div>
        <button onClick={load} className="h-10 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium flex items-center gap-2"
          data-testid="aging-refresh-btn">
          <RefreshCcw size={16} /> Yenile
        </button>
      </div>

      {data.totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 border border-border bg-card rounded-xl" data-testid="aging-total-cars">
            <div className="text-[11px] uppercase text-muted-foreground mb-1">Toplam Stok</div>
            <div className="text-2xl font-bold">{data.totals.total_cars}</div>
          </div>
          <div className="p-4 border border-amber-500/40 bg-amber-500/5 rounded-xl" data-testid="aging-stale-cars">
            <div className="text-[11px] uppercase text-amber-600 mb-1 flex items-center gap-1">
              <AlertTriangle size={12} /> 30+ gün
            </div>
            <div className="text-2xl font-bold text-amber-600">{data.totals.stale_cars}</div>
          </div>
          <div className="p-4 border border-border bg-card rounded-xl">
            <div className="text-[11px] uppercase text-muted-foreground mb-1">Bağlı Sermaye</div>
            <div className="text-xl font-bold">{formatCurrency(data.totals.total_capital)}</div>
          </div>
          <div className="p-4 border border-primary/40 bg-primary/5 rounded-xl">
            <div className="text-[11px] uppercase text-primary mb-1 flex items-center gap-1">
              <TrendingUp size={12} /> Günlük Maliyet (@%{data.totals.yearly_rate_pct})
            </div>
            <div className="text-xl font-bold text-primary">{formatCurrency(data.totals.daily_cost)}</div>
          </div>
        </div>
      )}

      {data.buckets && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card border border-border rounded-xl p-4" data-testid="aging-buckets">
          {Object.entries(data.buckets).map(([bucket, count]) => (
            <div key={bucket} className="text-center p-3 border border-border rounded-lg">
              <div className="text-[10px] uppercase text-muted-foreground">{bucket} gün</div>
              <div className="text-2xl font-bold">{count}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Yükleniyor…</div>
        ) : data.rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Aktif stokta araç yok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]" data-testid="aging-table">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
                  <th className="text-left p-3">Plaka</th>
                  <th className="text-left p-3">Araç</th>
                  <th className="text-center p-3">Giriş</th>
                  <th className="text-center p-3">Stokta Gün</th>
                  <th className="text-right p-3">Maliyet</th>
                  <th className="text-right p-3">Günlük</th>
                  <th className="text-right p-3">Birikmiş</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.car_id} className="border-b border-border hover:bg-muted/20" data-testid={`aging-row-${r.car_id}`}>
                    <td className="p-3 text-sm font-semibold">{r.plate}</td>
                    <td className="p-3 text-sm">{r.brand} {r.model} ({r.year})</td>
                    <td className="p-3 text-sm text-center text-muted-foreground">{r.entry_date || '-'}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${bucketColor(r.days_in_stock)}`}>
                        {r.days_in_stock} gün
                      </span>
                    </td>
                    <td className="p-3 text-sm text-right tabular-nums">{formatCurrency(r.purchase_price)}</td>
                    <td className="p-3 text-sm text-right tabular-nums text-muted-foreground">{formatCurrency(r.daily_cost)}</td>
                    <td className={`p-3 text-sm text-right tabular-nums font-bold ${r.is_stale ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {formatCurrency(r.accumulated_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockAgingPage;
