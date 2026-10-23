import React, { useMemo } from 'react';
import { PackagePlus, Info } from 'lucide-react';
import { isVehicleCost } from '../../../utils/expenseClassifier';

/**
 * Araç Yatırımı Raporu — Stoka eklenen araçlar + araç-bağlı maliyetler.
 *
 * **Önemli muhasebe notu:** Bu kalemler "gider" DEĞİLDİR. Bilanço açısından
 * varlık dönüşümüdür (Nakit → Araç). Öz sermayeyi azaltmaz. Satış sırasında
 * araç maliyetine eklenir ve kâr/zarar hesabında düşülür.
 *
 * Bu raporda 2 grup gösterilir:
 *   1. Araç Alımları (purchase_price ile yeni stoka giren araçlar)
 *   2. Araç-Bağlı Maliyetler (Ekspertiz, Noter, Çekici, Bakım vb. — araç-bağımlı tx'ler)
 */
export const VehicleInvestmentReportBody = ({ activeCars, activeTransactions, startDate, endDate, formatDate }) => {
  const fmt = (val) => `₺${Number(val || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // 1) Tarih aralığında stoka giren araçların alış maliyeti
  const newCars = useMemo(() => {
    return activeCars
      .filter((c) => c.ownership === 'stock')
      .filter((c) => {
        const d = c.entry_date || '';
        return d >= startDate && d <= endDate;
      })
      .map((c) => ({
        car_id: c.id,
        plate: (c.plate || '').toUpperCase(),
        brand: c.brand,
        model: c.model,
        year: c.year,
        entry_date: c.entry_date,
        purchase_price: Number(c.purchase_price || 0),
        status: c.status,
      }))
      .sort((a, b) => (b.entry_date || '').localeCompare(a.entry_date || ''));
  }, [activeCars, startDate, endDate]);

  const totalPurchases = newCars.reduce((s, c) => s + c.purchase_price, 0);

  // 2) Araç-bağlı maliyet tx'leri (Araç Alımı hariç — onlar zaten purchase_price'da)
  const vehicleCostTxs = useMemo(() => {
    return activeTransactions
      .filter((t) => isVehicleCost(t) && t.car_id && t.category !== 'Araç Alımı')
      .filter((t) => (t.date || '') >= startDate && (t.date || '') <= endDate)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [activeTransactions, startDate, endDate]);

  const totalVehicleCosts = vehicleCostTxs.reduce((s, t) => s + Number(t.amount || 0), 0);
  const grandTotal = totalPurchases + totalVehicleCosts;

  // Kategori kırılımı (maliyet tx'leri için)
  const byCategory = useMemo(() => {
    const map = {};
    for (const t of vehicleCostTxs) {
      const cat = t.category || 'Diğer';
      if (!map[cat]) map[cat] = { count: 0, amount: 0 };
      map[cat].count += 1;
      map[cat].amount += Number(t.amount || 0);
    }
    return Object.entries(map)
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [vehicleCostTxs]);

  return (
    <div className="space-y-4" data-testid="investment-report-body">
      {/* Üst bant — Toplam yatırım */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-2 border-emerald-500/40 bg-emerald-500/5 rounded-xl flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <PackagePlus size={22} className="text-emerald-500" />
          <div>
            <h3 className="font-semibold text-sm sm:text-base text-emerald-500">Toplam Araç Yatırımı</h3>
            <p className="text-[11px] text-muted-foreground">
              {newCars.length} yeni araç · {vehicleCostTxs.length} araç-bağlı maliyet hareketi
            </p>
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-emerald-500 tabular-nums">{fmt(grandTotal)}</div>
      </div>

      {/* Bilgi notu */}
      <div className="bg-ti-gold/5 border border-ti-gold/30 rounded-lg px-3 py-2.5 flex items-start gap-2 text-[12px]">
        <Info size={14} className="text-ti-gold flex-shrink-0 mt-0.5" />
        <div className="text-muted-foreground leading-relaxed">
          <strong className="text-ti-gold">Bu yatırımlar gider DEĞİLDİR.</strong> Araç alımları ve araç-bağlı maliyetler (Ekspertiz, Noter, Çekici, Bakım vb.) varlık dönüşümüdür. Öz sermayenizi azaltmaz — araç satılana kadar stok değerinde kalır. Satış anında bu maliyetler toplam araç maliyetinden düşülerek <strong>brüt kâr</strong> hesaplanır.
        </div>
      </div>

      {/* İki kart yan yana */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-4">
          <div className="text-[10px] tracking-widest uppercase text-emerald-500 font-bold mb-1">Araç Alımları</div>
          <div className="text-2xl font-bold text-emerald-500 tabular-nums">{fmt(totalPurchases)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{newCars.length} araç stoka eklendi</div>
        </div>
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-4">
          <div className="text-[10px] tracking-widest uppercase text-amber-500 font-bold mb-1">Araç-Bağlı Maliyetler</div>
          <div className="text-2xl font-bold text-amber-500 tabular-nums">{fmt(totalVehicleCosts)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Ekspertiz · Noter · Bakım · Çekici vb.</div>
        </div>
      </div>

      {/* 1) Yeni araçlar */}
      {newCars.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-muted/30 p-3 border-b border-border flex items-center justify-between">
            <h4 className="font-semibold text-sm">🚗 Stoka Giren Araçlar ({newCars.length})</h4>
            <span className="text-[11px] font-bold text-emerald-500 tabular-nums">{fmt(totalPurchases)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/10">
              <tr className="border-b border-border">
                <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground uppercase">Tarih</th>
                <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground uppercase">Plaka</th>
                <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground uppercase">Araç</th>
                <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground uppercase">Durum</th>
                <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground uppercase">Alış</th>
              </tr>
            </thead>
            <tbody>
              {newCars.map((c) => (
                <tr key={c.car_id} className="border-b border-border last:border-0 hover:bg-muted/20" data-testid={`investment-car-${c.car_id}`}>
                  <td className="p-2.5 text-xs tabular-nums text-muted-foreground">{formatDate(c.entry_date)}</td>
                  <td className="p-2.5 text-xs font-mono font-semibold">{c.plate || '-'}</td>
                  <td className="p-2.5 text-xs">{c.brand} {c.model} <span className="text-muted-foreground">({c.year})</span></td>
                  <td className="p-2.5 text-xs">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      c.status === 'Satıldı' ? 'bg-emerald-500/15 text-emerald-500' :
                      c.status === 'Kapora Alındı' ? 'bg-amber-500/15 text-amber-500' :
                      'bg-sky-500/15 text-sky-500'
                    }`}>{c.status}</span>
                  </td>
                  <td className="p-2.5 text-xs text-right font-semibold text-emerald-500 tabular-nums">{fmt(c.purchase_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 2) Araç-bağlı maliyetler — kategori bazlı */}
      {byCategory.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-muted/30 p-3 border-b border-border flex items-center justify-between">
            <h4 className="font-semibold text-sm">🔧 Araç-Bağlı Maliyetler — Kategori Dağılımı</h4>
            <span className="text-[11px] font-bold text-amber-500 tabular-nums">{fmt(totalVehicleCosts)}</span>
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
                  <td className="p-2.5 text-xs text-right tabular-nums font-semibold text-amber-500">{fmt(b.amount)}</td>
                  <td className="p-2.5 text-xs text-right tabular-nums text-muted-foreground">
                    {totalVehicleCosts > 0 ? `${((b.amount / totalVehicleCosts) * 100).toFixed(1)}%` : '0%'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {grandTotal === 0 && (
        <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
          Bu tarih aralığında araç yatırımı bulunamadı.
        </div>
      )}
    </div>
  );
};

export default VehicleInvestmentReportBody;
