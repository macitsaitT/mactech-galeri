import React, { useMemo } from 'react';
import { X, Receipt, PieChart as PieIcon, Info } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '../../utils/helpers';

/**
 * İşletme Gideri Kategori Dağılım Modalı.
 *
 * Backend /api/finance/summary'den gelen `operating_breakdown` verisini
 * pasta grafiği + sıralı tablo şeklinde gösterir. Tarih filtresi
 * Dashboard'dakiyle senkron çalışır (parent component'ten gelir).
 *
 * Kafa karışıklığını engellemek için üstte net bir uyarı vardır:
 * Bu rakamlar **sadece** araç-bağımsız operasyonel giderlerdir.
 */
const COLORS = ['#C5A267', '#ef4444', '#3b82f6', '#a855f7', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#f97316'];

const OperatingBreakdownModal = ({ isOpen, onClose, breakdown = [], totalAmount = 0, period = null }) => {
  const data = useMemo(() => {
    return (breakdown || []).map((item, idx) => ({
      ...item,
      fill: COLORS[idx % COLORS.length],
      pct: totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0,
    }));
  }, [breakdown, totalAmount]);

  if (!isOpen) return null;

  const periodLabel = period?.start && period?.end
    ? `${period.start} → ${period.end}`
    : 'Tüm Zamanlar';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
      data-testid="operating-breakdown-overlay"
    >
      <div
        className="bg-card border border-rose-500/30 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="operating-breakdown-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
              <Receipt size={20} className="text-rose-500" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg text-foreground">İşletme Gideri Detayı</h2>
              <p className="text-xs text-muted-foreground">{periodLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            data-testid="operating-breakdown-close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Top — total */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-rose-500/5 border border-rose-500/30">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-rose-500 font-bold">Toplam Dönem İşletme Gideri</p>
              <p className="text-xs text-muted-foreground mt-1">Bu rakam öz sermayeyi DOĞRUDAN azaltır</p>
            </div>
            <div className="text-3xl font-bold text-rose-500 tabular-nums">-{formatCurrency(totalAmount)}</div>
          </div>

          {/* Bilgi notu */}
          <div className="bg-ti-gold/5 border border-ti-gold/30 rounded-lg px-3 py-2.5 flex items-start gap-2 text-[12px]">
            <Info size={14} className="text-ti-gold flex-shrink-0 mt-0.5" />
            <div className="text-muted-foreground leading-relaxed">
              <strong className="text-ti-gold">Bu kart sadece işletme giderlerini gösterir.</strong> Araç alımları ve araç-bağlı maliyetler (Ekspertiz, Noter, Çekici, Bakım vb.) <strong>burada YOK</strong> — onlar varlık olarak Stok Araç Değeri kartında izleniyor.
            </div>
          </div>

          {data.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
              <PieIcon size={32} className="mx-auto mb-2 opacity-40" />
              <p>Bu tarih aralığında işletme gideri yok.</p>
              <p className="text-xs mt-2 text-muted-foreground/70">Kira, Maaş, Reklam, Vergi vb. giderler bu raporda görünür.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pasta grafiği */}
              <div className="border border-border rounded-xl p-4 bg-muted/10">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <PieIcon size={14} className="text-ti-gold" />
                  Dağılım
                </h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {data.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => formatCurrency(v)}
                        contentStyle={{
                          background: 'hsl(0 0% 8%)',
                          border: '1px solid hsl(38 20% 18%)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: 'hsl(0 0% 98%)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Kategori listesi */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/30 px-3 py-2.5 border-b border-border">
                  <h3 className="text-sm font-semibold">Kategori Sıralaması</h3>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-border">
                  {data.map((item, idx) => (
                    <div key={item.category} className="p-3 hover:bg-muted/20 transition-colors" data-testid={`operating-cat-${idx}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: item.fill }} />
                          <span className="text-sm font-medium truncate">{item.category}</span>
                        </div>
                        <span className="text-sm font-bold text-rose-500 tabular-nums flex-shrink-0">-{formatCurrency(item.amount)}</span>
                      </div>
                      {/* % bar */}
                      <div className="flex items-center gap-2 ml-4">
                        <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${item.pct}%`, background: item.fill }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">{item.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperatingBreakdownModal;
