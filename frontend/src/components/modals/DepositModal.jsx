import React, { useState, useEffect } from 'react';
import { CreditCard, UserPlus } from 'lucide-react';
import { formatNumberInput, parseNumber, formatCurrency } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const DepositModal = ({ isOpen, onClose, car, onConfirmDeposit, onCancelDeposit }) => {
  const { customers, addCustomer } = useApp();
  const [amount, setAmount] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    if (car && isOpen) {
      setAmount(car.deposit_amount > 0 ? formatNumberInput(car.deposit_amount) : '');
      setCustomerId(car.deposit_customer_id || '');
      setShowNewCustomer(false);
      setNewName('');
      setNewPhone('');
    }
  }, [car, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!car || parseNumber(amount) <= 0) return;

    setLoading(true);
    try {
      let finalCustomerId = customerId;
      let customerName = '';

      // Create new customer if needed
      if (showNewCustomer && newName) {
        const newCustomer = await addCustomer({ name: newName, phone: newPhone, type: 'Bireysel', notes: '' });
        if (newCustomer) {
          finalCustomerId = newCustomer.id;
          customerName = newName;
        }
      } else if (finalCustomerId) {
        const selected = customers.find(c => c.id === finalCustomerId);
        customerName = selected?.name || '';
      }

      await onConfirmDeposit({
        carId: car.id,
        amount: parseNumber(amount),
        existingAmount: car.deposit_amount || 0,
        customerId: finalCustomerId,
        customerName: customerName,
        depositDate: new Date().toISOString().split('T')[0]
      });
      onClose();
    } catch (error) {
      console.error('Error confirming deposit:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!car || !window.confirm('Kaporayı iade etmek istediğinize emin misiniz?')) return;

    setLoading(true);
    try {
      await onCancelDeposit(car.id);
      onClose();
    } catch (error) {
      console.error('Error canceling deposit:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!car) return null;

  const existingDeposit = car.deposit_amount || 0;
  const activeCustomers = customers.filter(c => !c.deleted);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="deposit-modal-title">
            <CreditCard size={24} className="text-warning" />
            {existingDeposit > 0 ? 'Kapora Düzenle' : 'Kapora Al'}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {/* Car Info */}
          <div className="p-4 bg-muted/50 rounded-lg mb-6">
            <p className="font-semibold">{car.brand} {car.model}</p>
            <p className="text-sm text-muted-foreground">{car.plate?.toUpperCase()}</p>
            <p className="text-sm text-primary font-medium mt-1">
              Satış Fiyatı: {formatCurrency(car.sale_price)}
            </p>
          </div>

          {existingDeposit > 0 && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg mb-4">
              <p className="text-sm text-warning">
                Mevcut Kapora: <strong>{formatCurrency(existingDeposit)}</strong>
              </p>
              {car.deposit_customer_name && (
                <p className="text-xs text-warning/80 mt-1">
                  Müşteri: {car.deposit_customer_name} | Tarih: {car.deposit_date || '-'}
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {existingDeposit > 0 ? 'Yeni Kapora Tutarı (₺)' : 'Kapora Tutarı (₺)'}
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(formatNumberInput(e.target.value))}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                placeholder="0"
                data-testid="deposit-amount-input"
              />
            </div>

            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Müşteri</label>
              {!showNewCustomer ? (
                <div className="space-y-2">
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                    data-testid="deposit-customer-select"
                  >
                    <option value="">Müşteri seçin</option>
                    {activeCustomers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(true)}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    data-testid="new-deposit-customer-btn"
                  >
                    <UserPlus size={14} />
                    Yeni Müşteri Ekle
                  </button>
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    placeholder="Ad Soyad"
                    data-testid="deposit-new-name"
                  />
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    placeholder="Telefon"
                    data-testid="deposit-new-phone"
                  />
                  <button
                    type="button"
                    onClick={() => { setShowNewCustomer(false); setNewName(''); setNewPhone(''); }}
                    className="text-sm text-muted-foreground hover:underline"
                  >
                    Mevcut müşteriden seç
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              <button
                type="submit"
                disabled={loading || parseNumber(amount) <= 0}
                className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                data-testid="confirm-deposit-btn"
              >
                {loading ? 'İşleniyor...' : 'Kaporayı Kaydet'}
              </button>

              {existingDeposit > 0 && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="w-full py-3 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  data-testid="cancel-deposit-btn"
                >
                  Kaporayı İade Et
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                data-testid="close-deposit-btn"
              >
                Kapat
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DepositModal;
