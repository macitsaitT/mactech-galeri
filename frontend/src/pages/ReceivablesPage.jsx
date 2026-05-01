import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, RefreshCcw, Phone, TrendingDown } from 'lucide-react';
import { installmentsAPI } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { toast } from 'sonner';

const ReceivablesPage = () => {
  const [data, setData] = useState({ rows: [], totals: null });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all | overdue | upcoming

  const load = async () => {
    setLoading(true);
    try {
      const res = await installmentsAPI.overdue();
      setData({ rows: res.data?.rows || [], totals: res.data?.totals });
    } catch {
      toast.error('Alacak bilgisi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = data.rows.filter(r => filter === 'all' || (filter === 'overdue' ? r.is_overdue : !r.is_overdue));

  return (
    <div className="space-y-4" data-testid="receivables-page">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <TrendingDown size={22} className="text-destructive" />
            Alacaklar (Vadeli Satış Takibi)
          </h2>
          <p className="text-sm text-muted-foreground">
            Vadesi gelen ve geciken taksit ödemeleri özet ve detay tablosu.
          </p>
        </div>
        <button onClick={load} className="h-10 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium flex items-center gap-2"
          data-testid="receivables-refresh-btn">
          <RefreshCcw size={16} /> Yenile
        </button>
      </div>

      {data.totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 border border-destructive/40 bg-destructive/5 rounded-xl" data-testid="receivables-summary-overdue">
            <div className="text-[11px] uppercase tracking-wider text-destructive mb-1 flex items-center gap-1">
              <AlertTriangle size={12} /> Geciken Ödeme
            </div>
            <div className="text-xl font-bold text-destructive">{formatCurrency(data.totals.overdue_amount)}</div>
            <div className="text-xs text-muted-foreground mt-1">{data.totals.overdue_count} müşteri</div>
          </div>
          <div className="p-4 border border-border bg-card rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Vadesi Yaklaşan</div>
            <div className="text-xl font-bold">{data.totals.upcoming_count}</div>
          </div>
          <div className="p-4 border border-border bg-card rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Toplam Kalan</div>
            <div className="text-xl font-bold">{formatCurrency(data.totals.total_remaining)}</div>
          </div>
          <div className="p-4 border border-border bg-card rounded-xl flex items-center">
            <div className="inline-flex rounded-lg border border-border overflow-hidden w-full" data-testid="receivables-filter">
              {[['all','Tümü'],['overdue','Geciken'],['upcoming','Yaklaşan']].map(([v,l]) => (
                <button key={v} onClick={() => setFilter(v)}
                  className={`flex-1 px-2 py-1.5 text-xs font-semibold ${filter === v ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                  data-testid={`receivables-filter-${v}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Yükleniyor…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]" data-testid="receivables-table">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
                  <th className="text-left p-3">Müşteri</th>
                  <th className="text-left p-3">Başlangıç</th>
                  <th className="text-right p-3">Toplam</th>
                  <th className="text-right p-3">Ödenen</th>
                  <th className="text-right p-3">Kalan</th>
                  <th className="text-right p-3">Geciken</th>
                  <th className="text-center p-3">Gecikme</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted-foreground">
                      {filter === 'overdue' ? 'Geciken ödeme yok — temiz!' : 'Aktif vadeli satış yok.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(r => (
                    <tr key={r.installment_id}
                        className={`border-b border-border hover:bg-muted/20 ${r.is_overdue ? 'bg-destructive/5' : ''}`}
                        data-testid={`receivable-row-${r.installment_id}`}>
                      <td className="p-3 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {r.is_overdue && <AlertTriangle size={14} className="text-destructive shrink-0" />}
                          {r.customer_name}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{formatDate(r.start_date)}</td>
                      <td className="p-3 text-sm text-right tabular-nums">{formatCurrency(r.total_amount)}</td>
                      <td className="p-3 text-sm text-right tabular-nums text-success">{formatCurrency(r.paid_amount)}</td>
                      <td className="p-3 text-sm text-right tabular-nums font-semibold">{formatCurrency(r.remaining_amount)}</td>
                      <td className={`p-3 text-sm text-right tabular-nums font-bold ${r.is_overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {r.overdue_amount > 0 ? formatCurrency(r.overdue_amount) : '-'}
                      </td>
                      <td className="p-3 text-center">
                        {r.days_overdue > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-destructive/15 text-destructive text-xs font-semibold">
                            <Clock size={10} /> {r.days_overdue} gün
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceivablesPage;
