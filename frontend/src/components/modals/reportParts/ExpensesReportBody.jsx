import React from 'react';
import { Plus } from 'lucide-react';

// ✅ Araç Masrafları Raporu — ReportModal.jsx'ten ayrıldı (refactor)
// Sadece "expense" tipindeki tx'leri araç bazlı listeler.
// Her araç için tarih filtresinde toplam masraf gösterilir, satırlar düzenlenebilir.
export const ExpensesReportBody = ({ activeTransactions, activeCars, startDate, endDate, selectedCarId, setExpensesFor, formatDate }) => {
  const formatCurrency = (val) => `₺${Number(val || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Araç Alımı / Araç Sahibine Ödeme kategorileri "alış" sayıldığı için masraf raporundan çıkarılır.
  const EXCLUDE_CATEGORIES = new Set(['Araç Alımı', 'Araç Sahibine Ödeme']);

  const filteredExpenses = activeTransactions
    .filter((t) => t.type === 'expense' && t.car_id && !EXCLUDE_CATEGORIES.has(t.category))
    .filter((t) => (t.date || '') >= startDate && (t.date || '') <= endDate)
    .filter((t) => !selectedCarId || t.car_id === selectedCarId);

  const groups = {};
  for (const tx of filteredExpenses) {
    if (!groups[tx.car_id]) groups[tx.car_id] = [];
    groups[tx.car_id].push(tx);
  }

  const groupedArr = Object.entries(groups)
    .map(([carId, txs]) => {
      const car = activeCars.find((c) => c.id === carId);
      const total = txs.reduce((s, t) => s + Number(t.amount || 0), 0);
      return { carId, car, txs: txs.sort((a, b) => (b.date || '').localeCompare(a.date || '')), total };
    })
    .sort((a, b) => b.total - a.total);

  const grandTotal = filteredExpenses.reduce((s, t) => s + Number(t.amount || 0), 0);

  return (
    <div className="space-y-4" data-testid="expenses-report-body">
      <div className="flex items-center justify-between p-3 sm:p-4 border-2 border-amber-500/40 bg-amber-500/5 rounded-xl flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-sm sm:text-base text-amber-600">Toplam Araç Masrafları</h3>
          <p className="text-[11px] text-muted-foreground">
            {filteredExpenses.length} masraf · {groupedArr.length} araç
          </p>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-amber-600 tabular-nums">{formatCurrency(grandTotal)}</div>
      </div>

      {groupedArr.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
          Bu tarih aralığında araç masrafı bulunamadı.
          {selectedCarId && <p className="text-xs mt-2">Filtrelenen aracı kaldırıp tüm araçları görebilirsiniz.</p>}
        </div>
      ) : (
        groupedArr.map(({ carId, car, txs, total }) => (
          <div key={carId} className="border border-border rounded-xl overflow-hidden" data-testid={`expenses-group-${carId}`}>
            <div className="bg-muted/30 p-3 flex items-center justify-between flex-wrap gap-2 border-b border-border">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">
                  {car ? (
                    <>
                      {car.brand} {car.model} <span className="text-muted-foreground">({car.year})</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Silinmiş Araç</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {car?.plate?.toUpperCase() || carId.slice(0, 8)} · {txs.length} masraf
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground uppercase">Toplam</div>
                  <div className="text-base font-bold text-amber-600 tabular-nums">{formatCurrency(total)}</div>
                </div>
                {car && (
                  <button
                    type="button"
                    onClick={() => setExpensesFor(car)}
                    className="h-9 px-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 text-xs font-semibold flex items-center gap-1.5"
                    data-testid={`expenses-group-edit-${carId}`}
                    title="Bu aracın masraflarını düzenle / yeni ekle"
                  >
                    <Plus size={14} /> Düzenle
                  </button>
                )}
              </div>
            </div>

            {/* Satırlar — masaüstü tablo */}
            <div className="hidden sm:block">
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
                  {txs.map((tx) => (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/20" data-testid={`expense-row-${tx.id}`}>
                      <td className="p-2.5 text-xs text-muted-foreground tabular-nums">{formatDate(tx.date)}</td>
                      <td className="p-2.5 text-xs">{tx.category}</td>
                      <td className="p-2.5 text-xs text-muted-foreground truncate max-w-[200px]">{tx.description || '-'}</td>
                      <td className="p-2.5 text-xs text-right font-semibold text-destructive tabular-nums">-{formatCurrency(tx.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobil — kart */}
            <div className="sm:hidden divide-y divide-border">
              {txs.map((tx) => (
                <div key={tx.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{tx.category}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{tx.description || '-'}</div>
                    <div className="text-[10px] text-muted-foreground">{formatDate(tx.date)}</div>
                  </div>
                  <div className="text-sm font-semibold text-destructive tabular-nums shrink-0">-{formatCurrency(tx.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ExpensesReportBody;
