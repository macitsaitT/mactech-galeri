import React, { useEffect, useState } from 'react';
import { Phone, Car as CarIcon, Calendar, DollarSign, AlertCircle, FileSignature, ChevronRight, Loader2 } from 'lucide-react';
import { customersAPI, contractsAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import ContractHistoryModal from './ContractHistoryModal';

const TYPE_LABEL = { kapora: 'Kapora', delivery: 'Teslim', sale: 'Satış' };
const TYPE_COLOR = {
  kapora:   'bg-amber-500/10 text-amber-600 border-amber-500/30',
  delivery: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  sale:     'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
};

const CustomerDetailModal = ({ customerId, open, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!open || !customerId) {
      // modal kapanınca state'i sıfırla — bir sonraki açılışta stale data göstermesin
      if (!open) { setData(null); setContracts([]); }
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await customersAPI.getDetail(customerId);
        setData(res.data);
      } catch {
        toast.error('Müşteri detayı alınamadı');
      } finally {
        setLoading(false);
      }
    })();
    // ✅ Sözleşme geçmişi paralel yüklenir (UI'yı bloklamaz, hata sessiz)
    (async () => {
      setContractsLoading(true);
      try {
        const { data: list } = await contractsAPI.list({ customer_id: customerId, limit: 5 });
        setContracts(Array.isArray(list) ? list : []);
      } catch {
        // sessiz hata — sözleşme yoksa veya endpoint hata verirse
      } finally {
        setContractsLoading(false);
      }
    })();
  }, [open, customerId]);

  if (!open) return null;

  const totals = data?.totals || {};

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-5 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            {data?.customer?.name || 'Müşteri Detayı'}
          </DialogTitle>
          <DialogDescription>
            Satın alınan araçlar, ödeme geçmişi ve kalan borçlar tek ekranda.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5" data-testid="customer-detail-body">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Yükleniyor…</div>
          ) : !data ? (
            <div className="text-center py-8 text-muted-foreground">Veri yok</div>
          ) : (
            <>
              {/* İletişim */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {data.customer.phone && (
                  <span className="flex items-center gap-1"><Phone size={13} /> {data.customer.phone}</span>
                )}
                <span className="px-2 py-0.5 rounded bg-muted text-xs">{data.customer.type}</span>
              </div>

              {/* Özet */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 border border-border rounded-lg bg-card">
                  <div className="text-[10px] uppercase text-muted-foreground">Araç Sayısı</div>
                  <div className="text-xl font-bold">{totals.total_purchases || 0}</div>
                </div>
                <div className="p-3 border border-border rounded-lg bg-card">
                  <div className="text-[10px] uppercase text-muted-foreground">Toplam Tutar</div>
                  <div className="text-sm font-bold">{formatCurrency(totals.total_spent || 0)}</div>
                </div>
                <div className="p-3 border border-border rounded-lg bg-card">
                  <div className="text-[10px] uppercase text-muted-foreground">Ödenen</div>
                  <div className="text-sm font-bold text-success">{formatCurrency(totals.total_paid || 0)}</div>
                </div>
                <div className="p-3 border border-border rounded-lg bg-card">
                  <div className="text-[10px] uppercase text-muted-foreground">Kalan Borç</div>
                  <div className={`text-sm font-bold ${totals.total_remaining > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {formatCurrency(totals.total_remaining || 0)}
                  </div>
                </div>
              </div>

              {/* Satın alınan araçlar */}
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <CarIcon size={16} className="text-primary" />
                  Satın Alınan Araçlar
                </h3>
                {data.purchased_cars.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Henüz satın alınan araç yok.</p>
                ) : (
                  <div className="space-y-2">
                    {data.purchased_cars.map(car => (
                      <div key={car.id} className="p-3 border border-border rounded-lg bg-card" data-testid={`detail-car-${car.id}`}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="font-semibold">
                              {car.brand} {car.model} ({car.year})
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {car.plate?.toUpperCase()} • Satış: {formatDate(car.sold_date)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">{formatCurrency(car.sale_price)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              Ödenen: <span className="text-success font-semibold">{formatCurrency(car.total_paid)}</span>
                            </div>
                            {car.remaining > 0 && (
                              <div className="text-[11px] text-destructive font-semibold">
                                Kalan: {formatCurrency(car.remaining)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ✅ Bizden alınan araçlar — satıcı modu (bu kişiden aldığımız) */}
              {Array.isArray(data.sold_to_us_cars) && data.sold_to_us_cars.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <CarIcon size={16} className="text-amber-600" />
                    Bu Kişiden Aldığımız Araçlar
                    <span className="ml-auto text-xs text-muted-foreground">
                      Toplam Alış: <span className="font-bold text-amber-600">{formatCurrency(totals.total_sold_to_us_amount || 0)}</span>
                    </span>
                  </h3>

                  {/* ✅ Tedarikçi Performans Rozeti — bu satıcıdan alınıp sattığımız araçların brüt kâr ortalaması */}
                  {totals.seller_sold_count > 0 && (
                    <div
                      className={`mb-3 p-3 rounded-lg border flex items-center justify-between flex-wrap gap-2 ${
                        (totals.seller_avg_profit || 0) > 0
                          ? 'bg-success/5 border-success/30'
                          : 'bg-destructive/5 border-destructive/30'
                      }`}
                      data-testid="seller-performance-badge"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          (totals.seller_avg_profit || 0) > 0
                            ? 'bg-success/20 text-success'
                            : 'bg-destructive/20 text-destructive'
                        }`}>
                          TEDARİKÇİ PERFORMANSI
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {totals.seller_sold_count} araç satıldı
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Ortalama Brüt Kâr: </span>
                          <span className={`font-bold ${(totals.seller_avg_profit || 0) > 0 ? 'text-success' : 'text-destructive'}`} data-testid="seller-avg-profit">
                            {formatCurrency(totals.seller_avg_profit || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Toplam: </span>
                          <span className={`font-semibold ${(totals.seller_total_profit || 0) > 0 ? 'text-success' : 'text-destructive'}`}>
                            {formatCurrency(totals.seller_total_profit || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {data.sold_to_us_cars.map(car => (
                      <div key={car.id} className="p-3 border border-amber-500/30 bg-amber-500/5 rounded-lg" data-testid={`detail-sold-to-us-${car.id}`}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="font-semibold">
                              {car.brand} {car.model} ({car.year})
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {car.plate?.toUpperCase()} • Giriş: {formatDate(car.entry_date)} • Durum: <span className="font-medium">{car.status}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-muted-foreground">Alış</div>
                            <div className="text-sm font-bold text-amber-600">{formatCurrency(car.purchase_price)}</div>
                            {car.status === 'Satıldı' && typeof car.gross_profit === 'number' && (
                              <div className={`text-[11px] font-semibold ${car.gross_profit > 0 ? 'text-success' : 'text-destructive'}`}>
                                Brüt Kâr: {formatCurrency(car.gross_profit)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vadeli Taksit */}
              {data.installments.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-500" />
                    Aktif Vadeli Satışlar
                  </h3>
                  <div className="space-y-2">
                    {data.installments.map(ins => (
                      <div key={ins.id} className="p-3 border border-amber-500/30 bg-amber-500/5 rounded-lg text-sm" data-testid={`detail-installment-${ins.id}`}>
                        <div className="flex justify-between">
                          <span>Başlangıç: {formatDate(ins.start_date)}</span>
                          <span className="font-semibold">{ins.term_count} taksit</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Toplam: {formatCurrency(ins.total_amount)} • Peşin: {formatCurrency(ins.down_payment || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ✅ Sözleşme Geçmişi (özet — ilk 5 + Tümünü Gör) */}
              <div data-testid="customer-contracts-section">
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <FileSignature size={16} className="text-primary" />
                    Sözleşme Geçmişi
                    {contractsLoading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
                  </h3>
                  {contracts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(true)}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                      data-testid="customer-contracts-view-all"
                    >
                      Tümünü Gör <ChevronRight size={12} />
                    </button>
                  )}
                </div>
                {contracts.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic" data-testid="customer-contracts-empty">
                    {contractsLoading ? 'Yükleniyor…' : 'Bu müşteriye ait sözleşme yok.'}
                  </p>
                ) : (
                  <div className="space-y-1.5" data-testid="customer-contracts-list">
                    {contracts.slice(0, 5).map(item => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setHistoryOpen(true)}
                        className="w-full text-left p-2.5 border border-border bg-card rounded-lg hover:bg-muted/40 transition-colors flex items-center gap-2"
                        data-testid={`customer-contract-row-${item.id}`}
                      >
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${TYPE_COLOR[item.type] || 'border-border'}`}>
                          {TYPE_LABEL[item.type] || item.type}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">
                            {item.car_label || '—'} <span className="text-muted-foreground">· {item.car_plate || '—'}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatDate(item.created_at)}
                            {Number(item.sale_price) > 0 && <> · {formatCurrency(item.sale_price)}</>}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground/50 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Ödeme geçmişi */}
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <DollarSign size={16} className="text-success" />
                  Ödeme / İşlem Geçmişi
                </h3>
                {data.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">İşlem yok.</p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                    {data.transactions.map(t => (
                      <div key={t.id} className="p-2 flex justify-between items-center text-sm" data-testid={`detail-tx-${t.id}`}>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{t.category}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Calendar size={10} /> {formatDate(t.date)}
                            {t.description && <span className="truncate"> • {t.description}</span>}
                          </div>
                        </div>
                        <div className={`font-bold tabular-nums shrink-0 ${t.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

      {/* ✅ Sözleşme Geçmişi tam görünüm — bu müşteriye ait tüm sözleşmeler */}
      <ContractHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        customer={data?.customer || (customerId ? { id: customerId } : null)}
      />
    </>
  );
};

export default CustomerDetailModal;
