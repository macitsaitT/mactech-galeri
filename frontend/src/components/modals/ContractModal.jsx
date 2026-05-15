import React, { useState, useRef, useMemo, useEffect } from 'react';
import { FileSignature, Printer, Download } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog';
import { useApp } from '../../context/AppContext';
import SignaturePadComponent from '../contracts/SignaturePadComponent';
import { buildKaporaContract, buildDeliveryContract, buildSaleContract } from '../contracts/contractTemplates';
import { toast } from 'sonner';

const CONTRACT_TYPES = [
  { id: 'kapora',   label: 'Kapora Sözleşmesi',     build: buildKaporaContract },
  { id: 'delivery', label: 'Teslim Tutanağı',       build: buildDeliveryContract },
  { id: 'sale',     label: 'Satış Sözleşmesi',      build: buildSaleContract },
];

const ContractModal = ({ isOpen, onClose, car }) => {
  const { user, customers } = useApp();
  const [type, setType] = useState('sale');
  const [buyerId, setBuyerId] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Nakit');
  const [notes, setNotes] = useState('');

  const sellerSigRef = useRef(null);
  const buyerSigRef = useRef(null);

  // Önceki kayıtlı sözleşme yoksa ve aracın sale_price/customer_id varsa otomatik doldur
  useEffect(() => {
    if (!isOpen || !car) return;
    setBuyerId(car.customer_id || '');
    setSalePrice(String(car.sale_price || ''));
    setDepositAmount(String(car.deposit_amount || ''));
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    if (!dueDate) {
      const d = new Date(); d.setDate(d.getDate() + 7);
      setDueDate(d.toISOString().split('T')[0]);
    }
    // imzalar arasında bekle, parent re-render olmadan ref'ler kaybolmasın
  }, [isOpen, car]); // eslint-disable-line react-hooks/exhaustive-deps

  const buyer = useMemo(() => customers.find(c => c.id === buyerId) || {}, [customers, buyerId]);
  const today = new Date().toISOString().split('T')[0];

  const buildContext = () => {
    // Notes'dan TC çıkar (CustomerModal kimlik OCR'dan kaydetmiş olabilir)
    let tc = '';
    const m = String(buyer.notes || '').match(/TC[:\s]+(\d{11})/i);
    if (m) tc = m[1];

    return {
      contractNo: `${(car.plate || car.id || '').toString().toUpperCase().replace(/\s+/g, '')}-${Date.now().toString().slice(-6)}`,
      date: today,
      company: user?.company_name || 'MACTech Galeri',
      phone: user?.phone || '',
      car: car || {},
      seller: { name: user?.company_name || user?.name || 'Galeri', phone: user?.phone || '' },
      buyer: { name: buyer.name || '', phone: buyer.phone || '', tc },
      sale_price: Number(salePrice) || 0,
      deposit_amount: Number(depositAmount) || 0,
      due_date: dueDate,
      delivery_date: deliveryDate,
      delivery_km: car?.km || 0,
      payment_method: paymentMethod,
      fuel_level: 'Tam Depo',
      accessories: 'Ruhsat, anahtar (2 adet), kullanma kılavuzu',
      notes,
      sellerSig: sellerSigRef.current && !sellerSigRef.current.isEmpty() ? sellerSigRef.current.toDataURL('image/png') : null,
      buyerSig:  buyerSigRef.current  && !buyerSigRef.current.isEmpty()  ? buyerSigRef.current.toDataURL('image/png')  : null,
    };
  };

  const validate = () => {
    if (!car) return 'Araç bilgisi yok';
    if (!buyerId) return 'Alıcı (müşteri) seçin';
    if (type !== 'delivery' && !(Number(salePrice) > 0)) return 'Satış bedeli girin';
    if (type === 'kapora' && !(Number(depositAmount) > 0)) return 'Kapora tutarı girin';
    return null;
  };

  const openPrintable = (html) => {
    const w = window.open('', '_blank');
    if (!w) { toast.error('Pop-up engellendi — tarayıcı izinlerini açın'); return false; }
    w.document.open(); w.document.write(html); w.document.close();
    return true;
  };

  const handlePrint = () => {
    const err = validate();
    if (err) return toast.error(err);
    const ctx = buildContext();
    const cfg = CONTRACT_TYPES.find(c => c.id === type);
    if (!cfg) return;
    const html = cfg.build(ctx);
    if (openPrintable(html)) toast.success('Sözleşme açıldı — yazdır veya PDF olarak kaydet');
  };

  const handleDownloadHTML = () => {
    const err = validate();
    if (err) return toast.error(err);
    const ctx = buildContext();
    const cfg = CONTRACT_TYPES.find(c => c.id === type);
    if (!cfg) return;
    const html = cfg.build(ctx).replace(/<script[\s\S]*?<\/script>/g, '');
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${ctx.contractNo}_${type}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.success('HTML dosyası indirildi');
  };

  if (!car) return null;

  const needsSale = type !== 'delivery';
  const needsDeposit = type === 'kapora';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="contract-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature size={22} className="text-primary" />
            Sözleşme Oluştur — {(car.brand || '')} {(car.model || '')} {car.plate ? `(${car.plate.toUpperCase()})` : ''}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Araç için kapora, teslim tutanağı veya satış sözleşmesi oluştur ve imzala.
          </DialogDescription>
        </DialogHeader>

        {/* Tip seçici */}
        <div className="flex gap-1.5 mt-1 flex-wrap" data-testid="contract-type-row">
          {CONTRACT_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                type === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
              data-testid={`contract-type-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form alanları */}
        <div className="space-y-3 mt-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Alıcı (Müşteri) *</label>
            <select
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm"
              data-testid="contract-buyer-select"
            >
              <option value="">Seçin…</option>
              {customers.filter(c => !c.deleted).map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `· ${c.phone}` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {needsSale && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Satış Bedeli (TL) *</label>
                <input
                  type="number" min="0" step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm tabular-nums"
                  data-testid="contract-sale-price"
                  placeholder="0,00"
                />
              </div>
            )}
            {needsDeposit && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Kapora (TL) *</label>
                <input
                  type="number" min="0" step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm tabular-nums"
                  data-testid="contract-deposit-amount"
                  placeholder="0,00"
                />
              </div>
            )}
            {type === 'kapora' && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Son Ödeme Tarihi</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm"
                  data-testid="contract-due-date" />
              </div>
            )}
            {type === 'sale' && (
              <>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Ödeme Şekli</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm"
                    data-testid="contract-payment-method">
                    <option>Nakit</option>
                    <option>Havale / EFT</option>
                    <option>Kredi Kartı</option>
                    <option>Banka Kredisi</option>
                    <option>Karma</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Teslim Tarihi</label>
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm"
                    data-testid="contract-delivery-date" />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Daha Önce Yapılan Kapora</label>
                  <input type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm tabular-nums"
                    data-testid="contract-sale-prev-deposit"
                    placeholder="0,00" />
                </div>
              </>
            )}
            {type === 'delivery' && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Teslim Notları</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                  data-testid="contract-delivery-notes"
                  placeholder="Aracın genel durumu, eklenen aksesuar/belge…" />
              </div>
            )}
          </div>

          {/* İmza alanları */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <SignaturePadComponent ref={sellerSigRef} label="Satıcı İmzası" testId="seller" />
            <SignaturePadComponent ref={buyerSigRef}  label="Alıcı İmzası"  testId="buyer" />
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            İmzalar opsiyoneldir — boş bırakırsanız sözleşmede imza alanı çizgili kalır, fiziksel olarak imzalanabilir. Bir veya iki taraf parmak/mouse ile imza atabilir.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4 flex-wrap">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
            data-testid="contract-print-btn"
          >
            <Printer size={16} /> Yazdır / PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadHTML}
            className="h-11 px-4 rounded-lg border border-border text-sm font-semibold flex items-center justify-center gap-2 hover:bg-muted transition-colors"
            data-testid="contract-download-btn"
          >
            <Download size={16} /> HTML İndir
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContractModal;
