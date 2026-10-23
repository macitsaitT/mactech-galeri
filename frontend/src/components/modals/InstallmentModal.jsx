import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Plus, Trash2, FileDown, X, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useApp } from '../../context/AppContext';
import { installmentsAPI } from '../../services/api';
import { formatNumberInput, parseNumber, formatCurrency, formatDate } from '../../utils/helpers';
import { generateInstallmentPDF } from '../../utils/installmentPdf';

/**
 * Vadeli Satış Modalı (3 mod)
 * - mode='create': yeni vadeli satış oluştur (props: customerId, carId optional)
 * - mode='detail': mevcut vadeli satışı göster, ödeme ekle, PDF indir (props: installmentId)
 */
const InstallmentModal = ({ isOpen, onClose, mode = 'create', customerId, carId, installmentId }) => {
  const { customers, cars, user, refreshCapital, addTransaction, deleteTransaction } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [installment, setInstallment] = useState(null);

  // Create form
  const [form, setForm] = useState({
    customer_id: customerId || '',
    car_id: carId || '',
    total_amount: '',
    down_payment: '',
    term_count: '1',
    start_date: new Date().toISOString().split('T')[0],
    description: '',
  });

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentDesc, setPaymentDesc] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (mode === 'detail' && installmentId) {
      installmentsAPI.get(installmentId).then(res => setInstallment(res.data)).catch(() => {});
    } else {
      setInstallment(null);
      setForm({
        customer_id: customerId || '',
        car_id: carId || '',
        total_amount: '',
        down_payment: '',
        term_count: '1',
        start_date: new Date().toISOString().split('T')[0],
        description: '',
      });
    }
  }, [isOpen, mode, installmentId, customerId, carId]);

  const refresh = async () => {
    if (mode === 'detail' && installmentId) {
      const res = await installmentsAPI.get(installmentId);
      setInstallment(res.data);
    }
    await refreshCapital();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    const total = parseNumber(form.total_amount);
    if (!form.customer_id) return setError('Müşteri seçiniz.');
    if (!total || total <= 0) return setError('Toplam tutar giriniz.');
    setLoading(true);
    try {
      const created = await installmentsAPI.create({
        customer_id: form.customer_id,
        car_id: form.car_id || null,
        total_amount: total,
        down_payment: parseNumber(form.down_payment) || 0,
        term_count: parseInt(form.term_count, 10) || 1,
        start_date: form.start_date,
        description: form.description,
      });
      // Peşinat varsa ödeme olarak da kaydet (kasa+income transaction)
      if (parseNumber(form.down_payment) > 0) {
        try {
          await addTransaction({
            type: 'income',
            category: 'Taksit Ödemesi',
            amount: parseNumber(form.down_payment),
            date: form.start_date,
            description: `Peşinat - ${created.data.customer_name}`,
            customer_id: form.customer_id,
            car_id: form.car_id || null,
            installment_id: created.data.id,
          });
        } catch (_) {/* peşinat tx hatası vadeli kayıtı engellemesin */}
      }
      onClose();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = (detail && typeof detail === 'object' && detail.message) || detail || 'Vadeli satış kaydedilemedi.';
      setError(typeof msg === 'string' ? msg : 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async () => {
    setError('');
    const amt = parseNumber(paymentAmount);
    if (!amt || amt <= 0) return setError('Tutar giriniz.');
    if (!installment) return;
    setLoading(true);
    try {
      await addTransaction({
        type: 'income',
        category: 'Taksit Ödemesi',
        amount: amt,
        date: paymentDate,
        description: paymentDesc || `Taksit ödemesi - ${installment.customer_name}`,
        customer_id: installment.customer_id,
        car_id: installment.car_id || null,
        installment_id: installment.id,
      });
      setPaymentAmount('');
      setPaymentDesc('');
      await refresh();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = (detail && typeof detail === 'object' && detail.message) || detail || 'Ödeme eklenemedi.';
      setError(typeof msg === 'string' ? msg : 'Hata');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (txId) => {
    if (!window.confirm('Bu ödemeyi silmek istediğinize emin misiniz?')) return;
    try {
      await deleteTransaction(txId, true);
      await refresh();
    } catch (_) {}
  };

  const handlePDF = () => {
    if (!installment) return;
    const customer = customers.find(c => c.id === installment.customer_id);
    const car = cars.find(c => c.id === installment.car_id);
    generateInstallmentPDF({
      installment,
      customer,
      car,
      company: { name: user?.company_name || 'MACTech Galeri' },
    });
  };

  const monthlyPayment = useMemo(() => {
    const total = parseNumber(form.total_amount) || 0;
    const down = parseNumber(form.down_payment) || 0;
    const terms = parseInt(form.term_count, 10) || 1;
    return Math.max(0, (total - down) / terms);
  }, [form.total_amount, form.down_payment, form.term_count]);

  const activeCustomers = customers.filter(c => !c.deleted);
  const activeCars = cars.filter(c => !c.deleted);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard size={22} className="text-primary" />
            {mode === 'create' ? 'Yeni Vadeli Satış' : 'Vadeli Satış Detayı'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Müşteri *</label>
              <select
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                required
                data-testid="installment-customer-select"
              >
                <option value="">Müşteri seçin</option>
                {activeCustomers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">İlgili Araç (opsiyonel)</label>
              <select
                value={form.car_id}
                onChange={(e) => setForm({ ...form, car_id: e.target.value })}
                className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
              >
                <option value="">Araç seçin (opsiyonel)</option>
                {activeCars.map(c => <option key={c.id} value={c.id}>{(c.plate || '').toUpperCase()} - {c.brand} {c.model}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Toplam Tutar (₺) *</label>
                <input
                  type="text"
                  value={form.total_amount}
                  onChange={(e) => setForm({ ...form, total_amount: formatNumberInput(e.target.value) })}
                  placeholder="0"
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary"
                  data-testid="installment-total-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Peşinat (₺)</label>
                <input
                  type="text"
                  value={form.down_payment}
                  onChange={(e) => setForm({ ...form, down_payment: formatNumberInput(e.target.value) })}
                  placeholder="0"
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Vade Sayısı (ay)</label>
                <input
                  type="number"
                  min="1" max="120"
                  value={form.term_count}
                  onChange={(e) => setForm({ ...form, term_count: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Başlangıç Tarihi</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Açıklama</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Senet no, not vb."
                className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary"
              />
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex justify-between">
              <span className="text-muted-foreground">Aylık Tahmini Taksit:</span>
              <span className="font-bold text-primary">{formatCurrency(monthlyPayment)}</span>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2 border-t border-border">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">İptal</button>
              <button type="submit" disabled={loading} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50" data-testid="installment-create-submit">
                {loading ? 'Kaydediliyor...' : 'Vadeli Satışı Oluştur'}
              </button>
            </div>
          </form>
        )}

        {mode === 'detail' && installment && (
          <div className="mt-4 space-y-4">
            {/* Üst özet */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Toplam', value: installment.total_amount, color: 'text-foreground' },
                { label: 'Peşinat', value: installment.down_payment_amount, color: 'text-muted-foreground' },
                { label: 'Ödenen', value: installment.paid_amount, color: 'text-success' },
                { label: 'Kalan', value: installment.remaining_amount, color: 'text-destructive' },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                  <div className={`mt-1 text-base font-bold break-all ${s.color}`}>{formatCurrency(s.value || 0)}</div>
                </div>
              ))}
            </div>

            {installment.is_settled && (
              <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success" data-testid="installment-settled">
                <CheckCircle2 size={18} /> Borç tamamen ödenmiştir.
              </div>
            )}

            <div className="rounded-lg border border-border p-3 text-xs space-y-1 text-muted-foreground">
              <div className="flex justify-between"><span>Müşteri</span><span className="font-medium text-foreground">{installment.customer_name}</span></div>
              <div className="flex justify-between"><span>Sözleşme</span><span>{formatDate(installment.start_date)}</span></div>
              <div className="flex justify-between"><span>Vade Sayısı</span><span>{installment.term_count} ay</span></div>
              {installment.description && <div className="flex justify-between"><span>Not</span><span className="text-right">{installment.description}</span></div>}
            </div>

            {/* Ödeme ekle */}
            {!installment.is_settled && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                <div className="text-sm font-semibold text-primary flex items-center gap-2"><Plus size={16} /> Yeni Taksit Ödemesi</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(formatNumberInput(e.target.value))}
                    placeholder="Tutar"
                    className="h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    data-testid="installment-payment-amount"
                  />
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                  />
                  <input
                    type="text"
                    value={paymentDesc}
                    onChange={(e) => setPaymentDesc(e.target.value)}
                    placeholder="Açıklama (opsiyonel)"
                    className="h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddPayment}
                  disabled={loading || !paymentAmount}
                  className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                  data-testid="installment-add-payment-btn"
                >
                  {loading ? 'Ekleniyor...' : 'Ödemeyi Kaydet'}
                </button>
              </div>
            )}

            {/* Ödeme geçmişi */}
            <div>
              <div className="text-sm font-semibold mb-2">Ödemeler ({installment.payments?.length || 0})</div>
              {(installment.payments || []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Henüz ödeme yapılmamış.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {installment.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 p-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{formatCurrency(p.amount)}</div>
                        <div className="text-xs text-muted-foreground truncate">{formatDate(p.date)} · {p.description}</div>
                      </div>
                      <button onClick={() => handleDeletePayment(p.id)} className="p-1.5 hover:bg-destructive/10 rounded text-destructive" title="Ödemeyi sil">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between pt-2 border-t border-border">
              <button type="button" onClick={handlePDF} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-primary/40 text-primary font-semibold hover:bg-primary/10 transition-colors" data-testid="installment-pdf-btn">
                <FileDown size={16} /> PDF İndir
              </button>
              <button type="button" onClick={onClose} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                <X size={16} /> Kapat
              </button>
            </div>
          </div>
        )}

        {mode === 'detail' && !installment && (
          <div className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InstallmentModal;
