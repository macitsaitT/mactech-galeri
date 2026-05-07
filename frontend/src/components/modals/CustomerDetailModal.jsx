import React, { useEffect, useState } from 'react';
import { X, Phone, Car as CarIcon, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { customersAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

const CustomerDetailModal = ({ customerId, open, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !customerId) return;
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
  }, [open, customerId]);

  if (!open) return null;

  const totals = data?.totals || {};

  return (
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
  );
};

export default CustomerDetailModal;
