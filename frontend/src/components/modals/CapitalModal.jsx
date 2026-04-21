import React, { useState, useMemo } from 'react';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Settings2 } from 'lucide-react';
import { formatNumberInput, parseNumber, formatCurrency } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const TYPE_META = {
  deposit: { label: 'Kasa Girişi', icon: ArrowDownCircle, color: 'text-success', hint: 'Kasaya para yatır' },
  withdrawal: { label: 'Kasa Çıkışı', icon: ArrowUpCircle, color: 'text-destructive', hint: 'Kasadan para çek' },
  set: { label: 'Bakiye Düzenle', icon: Settings2, color: 'text-primary', hint: 'Başlangıç sermayesini ayarla' },
};

const CapitalModal = ({ isOpen, onClose }) => {
  const { capital, adjustCapital, setCapitalAmount } = useApp();
  const [mode, setMode] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentAmount = Number(capital?.amount || 0);
  const modes = useMemo(() => ['deposit', 'withdrawal', 'set'], []);

  const handleClose = () => {
    setMode('deposit');
    setAmount('');
    setDescription('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numeric = parseNumber(amount);
    if (!numeric || numeric <= 0) {
      setError('Geçerli bir tutar giriniz.');
      return;
    }
    if (mode === 'set' && numeric < 0) {
      setError('Bakiye negatif olamaz.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (mode === 'set') {
        await setCapitalAmount(numeric, description);
      } else {
        await adjustCapital(numeric, mode, description);
      }
      handleClose();
    } catch (err) {
      const msg = err?.response?.data?.detail?.message || err?.response?.data?.detail || 'İşlem başarısız oldu.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet size={22} className="text-primary" />
            Kasa İşlemi
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Mevcut Sermaye</div>
          <div className="mt-1 text-3xl font-bold text-primary" data-testid="capital-current-balance">
            {formatCurrency(currentAmount)}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {modes.map((m) => {
              const meta = TYPE_META[m];
              const Icon = meta.icon;
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors ${
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                  data-testid={`capital-mode-${m}`}
                >
                  <Icon size={20} className={active ? meta.color : ''} />
                  {meta.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">{TYPE_META[mode].hint}</p>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {mode === 'set' ? 'Yeni Bakiye' : 'Tutar'} (₺)
            </label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(formatNumberInput(e.target.value))}
              placeholder="0"
              className="h-12 w-full rounded-lg border border-border bg-background px-4 outline-none focus:border-primary"
              data-testid="capital-amount-input"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Açıklama (opsiyonel)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Örn: Kasa başlangıç, bankadan çekim..."
              className="h-11 w-full rounded-lg border border-border bg-background px-4 outline-none focus:border-primary text-sm"
              data-testid="capital-description-input"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" data-testid="capital-error">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-border px-6 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:shadow-xl active:scale-95 disabled:opacity-50"
              data-testid="capital-submit-btn"
            >
              {loading ? 'İşleniyor...' : TYPE_META[mode].label}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CapitalModal;
