import React, { useState, useEffect } from 'react';
import { X, Landmark, Info, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { capitalAPI } from '../../services/api';
import { toast } from 'sonner';

/**
 * Başlangıç Sermayesi Tanımlama Modalı.
 *
 * Bu değer sabit referans olarak tutulur — işlemler nedeniyle değişmez.
 * Güncel Öz Sermaye = Başlangıç + Net Kâr − İşletme Giderleri formülünde
 * baseline olarak kullanılır.
 */
const FoundingCapitalModal = ({ isOpen, onClose, currentValue = 0, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(currentValue > 0 ? String(currentValue) : '');
    }
  }, [isOpen, currentValue]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val < 0) {
      toast.error('Geçerli bir tutar girin');
      return;
    }
    setSaving(true);
    try {
      await capitalAPI.setFounding(val);
      toast.success('Başlangıç sermayesi kaydedildi');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
      data-testid="founding-modal-overlay"
    >
      <div
        className="bg-card border border-ti-gold/30 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="founding-modal"
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ti-gold/15 flex items-center justify-center">
              <Landmark size={20} className="text-ti-gold" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg text-foreground">Başlangıç Sermayesi</h2>
              <p className="text-xs text-muted-foreground">Sabit öz sermaye referansı</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            data-testid="founding-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-ti-gold/5 border border-ti-gold/20 rounded-lg p-3 mb-5">
          <div className="flex gap-2">
            <Info size={14} className="text-ti-gold flex-shrink-0 mt-0.5" />
            <div className="text-[12px] leading-relaxed text-muted-foreground">
              <p className="text-foreground font-semibold mb-1">Bu değer şirketinizin <span className="text-ti-gold">öz sermaye baseline</span>'ıdır.</p>
              <p>İşlemler nedeniyle değişmez. Sistem bu değere göre Güncel Öz Sermaye'yi hesaplar:</p>
              <p className="font-mono text-[11px] text-ti-gold mt-1.5">
                Güncel = Başlangıç + Net Kâr − İşletme Giderleri
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2 tracking-wider uppercase">
              Tutar (₺)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Örn: 10000000"
              autoFocus
              className="w-full h-14 px-4 bg-background border border-border rounded-lg text-xl font-bold tabular-nums focus:border-ti-gold focus:ring-2 focus:ring-ti-gold/20 transition-all outline-none"
              data-testid="founding-amount-input"
            />
            {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
              <p className="text-xs text-ti-gold mt-2 tracking-wider">
                = {formatCurrency(parseFloat(amount))}
              </p>
            )}
          </div>

          {currentValue > 0 && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">
              Mevcut değer: <span className="font-semibold text-foreground">{formatCurrency(currentValue)}</span>
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-lg border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium text-sm"
              data-testid="founding-cancel-btn"
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !amount}
              className="flex-1 h-11 rounded-lg gradient-gold text-primary-foreground font-bold tracking-wider uppercase text-sm shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="founding-save-btn"
            >
              {saving ? <><Loader2 size={16} className="animate-spin" /> Kaydediliyor...</> : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoundingCapitalModal;
