import React, { useMemo } from 'react';
import { Receipt } from 'lucide-react';
import { isOperatingExpense } from '../../../utils/expenseClassifier';

/**
 * İşletme Gideri Raporu — Kira, Maaş, SGK, Reklam, Vergi, Elektrik vb.
 *
 * Bu raporda **araç-bağlı giderler GÖSTERİLMEZ**. Araç alımları varlık dönüşümü
 * olduğundan ve araç-özel masraflar araç maliyetine eklendiğinden, sadece
 * doğrudan öz sermayeyi azaltan operasyonel giderler listelenir.
 */
export const OperatingExpenseReportBody = ({ activeTransactions, startDate, endDate, formatDate }) => {
  const fmt = (val) => `₺${Number(val || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const txs = useMemo(() => {
    return activeTransactions
      .filter(isOperatingExpense)
      .filter((t) => (t.date || '') >= startDate && (t.date || '') <= endDate)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [activeTransactions, startDate, endDate]);

  const total = txs.reduce((s, t) => s + Number(t.amount || 0), 0);

  // Kategori bazlı kırılım
  const byCategory = useMemo(() => {
    const map = {};
    for (const t of txs) {
      const cat = t.category || 'Diğer';
      if (!map[cat]) map[cat] = { count: 0, amount: 0 };
      map[cat].count += 1;
      map[cat].amount += Number(t.amount || 0);
    }
    return Object.entries(map)
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [txs]);

  return (
    <div className="space-y-4" data-testid="operating-report-body">
      {/* Üst bant — Toplam */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-2 border-rose-500/40 bg-rose-500/5 rounded-xl flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Receipt size={22} className="text-rose-500" />
          <div>
            <h3 className="font-semibold text-sm sm:text-base text-rose-500">Toplam İşletme Gideri</h3>
            <p className="text-[11px] text-muted-foreground">
              {txs.length} hareket · {byCategory.length} kategori · Bu giderler öz sermayeyi azaltır
            </p>
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-rose-500 tabular-nums">-{fmt(total)}</div>
      </div>

      {/* Bilgi notu */}
      <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-[11px] text-muted-foreground">
        ℹ️ Bu raporda <strong>sadece</strong> Kira, Maaş, SGK, Reklam, Vergi, Elektrik, İnternet, Ofis vb. <strong>işletme giderleri</strong> yer alır. Araç alımları ve araç-bağlı maliyetler (Ekspertiz, Noter, Çekici, Bakım vb.) bu raporda GÖSTERİLMEZ — onlar "Araç Yatırımı" raporundadır.
      </div>

      {txs.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
          Bu tarih aralığında işletme gideri bulunamadı.
        </div>
      ) : (
        <>
          {/* Kategori kırılımı */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-muted/30 p-3 border-b border-border">
              <h4 className="font-semibold text-sm">Kategori Dağılımı</h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/10">
                <tr className="border-b border-border">
                  <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground uppercase">Kategori</th>
                  <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground uppercase">Adet</th>
                  <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground uppercase">Tutar</th>
                  <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground uppercase">%</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((b) => (
                  <tr key={b.category} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="p-2.5 text-xs font-medium">{b.category}</td>
                    <td className="p-2.5 text-xs text-right tabular-nums text-muted-foreground">{b.count}</td>
                    <td className="p-2.5 text-xs text-right tabular-nums font-semibold text-rose-500">-{fmt(b.amount)}</td>
                    <td className="p-2.5 text-xs text-right tabular-nums text-muted-foreground">
                      {total > 0 ? `${((b.amount / total) * 100).toFixed(1)}%` : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detaylı satır listesi */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-muted/30 p-3 border-b border-border flex items-center justify-between">
              <h4 className="font-semibold text-sm">Tüm Hareketler</h4>
              <span className="text-[11px] text-muted-foreground">{txs.length} satır</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/10">
                <tr className="border-b border-border">
                  <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground uppercase">Tarih</th>
                  <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground uppercase">Kategori</th>
                  <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground uppercase">Açıklama</th>
                  <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground uppercase">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20" data-testid={`operating-row-${t.id}`}>
                    <td className="p-2.5 text-xs tabular-nums text-muted-foreground">{formatDate(t.date)}</td>
                    <td className="p-2.5 text-xs">{t.category}</td>
                    <td className="p-2.5 text-xs text-muted-foreground truncate max-w-[250px]">{t.description || '-'}</td>
                    <td className="p-2.5 text-xs text-right font-semibold text-rose-500 tabular-nums">-{fmt(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default OperatingExpenseReportBody;
