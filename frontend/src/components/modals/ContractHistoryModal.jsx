import React, { useState, useEffect, useCallback } from 'react';
import { FileSignature, Printer, Trash2, Loader2, Inbox, PenLine, Calendar } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog';
import { contractsAPI } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { buildKaporaContract, buildDeliveryContract, buildSaleContract } from '../contracts/contractTemplates';
import { toast } from 'sonner';

const TYPE_LABELS = {
  kapora: 'Kapora',
  delivery: 'Teslim Tutanağı',
  sale: 'Satış Sözleşmesi',
};

const TYPE_BUILDERS = {
  kapora: buildKaporaContract,
  delivery: buildDeliveryContract,
  sale: buildSaleContract,
};

const TYPE_COLORS = {
  kapora:   'bg-amber-500/10 text-amber-600 border-amber-500/30',
  delivery: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  sale:     'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
};

const fmtDate = (iso) => {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
};

const fmtMoney = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺';

const ContractHistoryModal = ({ isOpen, onClose, car, customer }) => {
  const { user, cars, customers } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const filter = car ? { car_id: car.id } : (customer ? { customer_id: customer.id } : {});
  const title = car
    ? `Sözleşme Geçmişi · ${car.brand || ''} ${car.model || ''} ${car.plate ? `(${car.plate.toUpperCase()})` : ''}`
    : customer
      ? `Sözleşme Geçmişi · ${customer.name}`
      : 'Sözleşme Geçmişi';

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const { data } = await contractsAPI.list(filter);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Sözleşmeler yüklenemedi');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, car?.id, customer?.id]);

  useEffect(() => { load(); }, [load]);

  // ✅ Yeniden yazdırma — backend'den tam sözleşme (imzalar dahil) al, HTML yeniden inşa et, popup'ta aç
  const handleReprint = async (item) => {
    setBusyId(item.id);
    try {
      const { data: full } = await contractsAPI.get(item.id);
      const carDoc = cars.find(c => c.id === full.car_id) || { id: full.car_id, plate: full.car_plate };
      const customerDoc = customers.find(c => c.id === full.customer_id) || { id: full.customer_id, name: full.customer_name };
      // TC notes'tan çıkar (eğer varsa)
      let tc = '';
      const m = String(customerDoc.notes || '').match(/TC[:\s]+(\d{11})/i);
      if (m) tc = m[1];

      const ctx = {
        contractNo: full.contract_no,
        date: full.created_at,
        company: user?.company_name || 'MACTech Galeri',
        phone: user?.phone || '',
        car: carDoc,
        seller: { name: user?.company_name || user?.name || 'Galeri', phone: user?.phone || '' },
        buyer: { name: customerDoc.name || full.customer_name || '', phone: customerDoc.phone || '', tc },
        sale_price: full.sale_price || 0,
        deposit_amount: full.deposit_amount || 0,
        due_date: full.due_date || '',
        delivery_date: full.delivery_date || '',
        delivery_km: carDoc?.km || 0,
        payment_method: full.payment_method || '',
        fuel_level: 'Tam Depo',
        accessories: 'Ruhsat, anahtar (2 adet), kullanma kılavuzu',
        notes: full.notes || '',
        sellerSig: full.seller_signature || null,
        buyerSig: full.buyer_signature || null,
      };

      const builder = TYPE_BUILDERS[full.type];
      if (!builder) { toast.error('Bilinmeyen sözleşme tipi'); return; }
      const html = builder(ctx);
      const w = window.open('', '_blank');
      if (!w) { toast.error('Pop-up engellendi — tarayıcı izinlerini açın'); return; }
      w.document.open(); w.document.write(html); w.document.close();
      toast.success('Sözleşme yeniden açıldı');
    } catch (e) {
      toast.error('Sözleşme açılamadı');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Sözleşmeyi silmek istediğine emin misin?\n${TYPE_LABELS[item.type]} · ${item.contract_no}`)) return;
    setBusyId(item.id);
    try {
      await contractsAPI.remove(item.id);
      setItems(prev => prev.filter(x => x.id !== item.id));
      toast.success('Sözleşme silindi');
    } catch (e) {
      toast.error('Silinemedi');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[88vh] overflow-y-auto" data-testid="contract-history-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature size={20} className="text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Bu araç veya müşteri için önceden oluşturulmuş sözleşmeleri görüntüle, yeniden yazdır veya sil.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground" data-testid="contract-history-loading">
            <Loader2 size={20} className="animate-spin mr-2" />
            Yükleniyor…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground" data-testid="contract-history-empty">
            <Inbox size={32} className="mb-2 opacity-50" />
            <p className="text-sm">Henüz sözleşme yok</p>
            <p className="text-[11px] mt-1">Sözleşme Oluştur'dan yeni bir kapora/teslim/satış sözleşmesi düzenleyin — yazdırıldığında otomatik geçmişe eklenir.</p>
          </div>
        ) : (
          <div className="space-y-2 mt-2" data-testid="contract-history-list">
            {items.map(item => (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors"
                data-testid={`contract-history-row-${item.id}`}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${TYPE_COLORS[item.type] || 'border-border'}`}>
                        {TYPE_LABELS[item.type] || item.type}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">#{item.contract_no}</span>
                    </div>
                    <div className="text-sm font-semibold truncate">
                      {item.car_label || '—'} <span className="text-muted-foreground font-normal">· {item.car_plate || '—'}</span>
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate mt-0.5">
                      Alıcı: <span className="text-foreground">{item.customer_name || '—'}</span>
                      {Number(item.sale_price) > 0 && <> · {fmtMoney(item.sale_price)}</>}
                      {Number(item.deposit_amount) > 0 && <> · Kapora: {fmtMoney(item.deposit_amount)}</>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(item.created_at)}</span>
                      {item.created_by_name && <span>· {item.created_by_name}</span>}
                      {item.has_seller_signature && <span className="flex items-center gap-1 text-emerald-600"><PenLine size={11} />S</span>}
                      {item.has_buyer_signature && <span className="flex items-center gap-1 text-emerald-600"><PenLine size={11} />A</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReprint(item)}
                      disabled={busyId === item.id}
                      className="h-8 px-2.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                      data-testid={`contract-history-reprint-${item.id}`}
                      title="Yeniden Yazdır"
                    >
                      {busyId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                      Yazdır
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={busyId === item.id}
                      className="h-8 px-2 rounded-md text-destructive hover:bg-destructive/10 text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                      data-testid={`contract-history-delete-${item.id}`}
                      title="Sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContractHistoryModal;
