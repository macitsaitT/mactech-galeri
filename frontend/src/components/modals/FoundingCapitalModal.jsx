import React, { useState, useEffect } from 'react';
import { X, Landmark, Info, Loader2, Plus, Minus, Pencil } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { capitalAPI } from '../../services/api';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const MODES = [
  { key: 'increase', label: 'Artır', icon: Plus },
  { key: 'decrease', label: 'Azalt', icon: Minus },
  { key: 'set', label: 'Yeni Tutar', icon: Pencil },
];

const MODE_HINT = {
  increase: 'Girilen tutar sermayeye eklenir ve kasaya nakit girişi olarak işlenir.',
  decrease: 'Girilen tutar sermayeden düşülür ve kasadan nakit çıkışı olarak işlenir.',
  set: 'Sermaye girdiğiniz tutara ayarlanır, aradaki fark kadar kasaya giriş veya kasadan çıkış yapılır.',
};

const FoundingCapitalModal = ({ isOpen, onClose, currentValue = 0, onSaved }) => {
  const [mode, setMode] = useState('increase');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(currentValue > 0 ? 'increase' : 'set');
      setAmount('');
    }
  }, [isOpen, currentValue]);

  if (!isOpen) return null;

  const val = parseFloat(amount);
  const valid = !isNaN(val) && (mode === 'set' ? val >= 0 : val > 0);
  const newValue = !valid ? null
    : mode === 'increase' ? currentValue + val
    : mode === 'decrease' ? currentValue - val
    : val;

  const handleSave = async () => {
    if (!valid) {
      toast.error('Geçerli bir tutar girin');
      return;
    }
    if (mode === 'decrease' && val > currentValue) {
      toast.error('Azaltılacak tutar mevcut sermayeden büyük olamaz');
      return;
    }
    setSaving(true);
    try {
      await capitalAPI.adjustFounding(val, mode);
      toast.success(mode === 'increase' ? 'Sermaye artırıldı' : mode === 'decrease' ? 'Sermaye azaltıldı' : 'Sermaye güncellendi');
      onSaved?.();
      onClose();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error((typeof d === 'object' ? d?.message : d) || 'Kayıt başarısız');
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
              <h2 className="font-heading font-bold text-lg text-foreground">Sermaye Düzenle</h2>
              <p className="text-xs text-muted-foreground">
                Mevcut: <span className="font-semibold text-foreground" data-testid="founding-current-value">{formatCurrency(currentValue)}</span>
              </p>
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

        <div className="grid grid-cols-3 gap-2 mb-4" data-testid="founding-mode-tabs">
          {MODES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                'h-10 rounded-lg border text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors',
                mode === key
                  ? key === 'decrease'
                    ? 'border-rose-500/60 bg-rose-500/15 text-rose-400'
                    : key === 'increase'
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                      : 'border-ti-gold/60 bg-ti-gold/15 text-ti-gold'
                  : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground'
              )}
              data-testid={`founding-mode-${key}`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="bg-ti-gold/5 border border-ti-gold/20 rounded-lg p-3 mb-4 flex gap-2">
          <Info size={14} className="text-ti-gold flex-shrink-0 mt-0.5" />
          <p className="text-[12px] leading-relaxed text-muted-foreground" data-testid="founding-mode-hint">
            {currentValue <= 0 && mode !== 'decrease'
              ? 'İlk tanımlama: Sermaye kaydedilir. Kasadaki mevcut paranız aynı kalır, öz sermaye ve tüm hesaplar buna göre güncellenir.'
              : MODE_HINT[mode]}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2 tracking-wider uppercase">
              {mode === 'set' ? 'Yeni Sermaye (₺)' : mode === 'increase' ? 'Eklenecek Tutar (₺)' : 'Düşülecek Tutar (₺)'}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Örn: 500000"
              autoFocus
              className="w-full h-14 px-4 bg-background border border-border rounded-lg text-xl font-bold tabular-nums focus:border-ti-gold focus:ring-2 focus:ring-ti-gold/20 transition-all outline-none"
              data-testid="founding-amount-input"
            />
            {valid && (
              <p className="text-xs text-ti-gold mt-2 tracking-wider">= {formatCurrency(val)}</p>
            )}
          </div>

          {newValue !== null && (
            <p
              className={cn('text-xs rounded-lg p-2.5', newValue < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-muted/40 text-muted-foreground')}
              data-testid="founding-new-value"
            >
              Yeni sermaye: <span className="font-semibold text-foreground">{formatCurrency(newValue)}</span>
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
