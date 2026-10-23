import React, { useState, useMemo } from 'react';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Settings2, History } from 'lucide-react';
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
  set: { label: 'Bakiye Düzenle', icon: Settings2, color: 'text-primary', hint: 'Bakiyeyi doğrudan belirle (geçmiş hesaba katmaz)' },
  initialize: {
    label: 'İlk Kurulum',
    icon: History,
    color: 'text-primary',
    hint: 'Başlangıç sermayesini girin — sistem geçmiş alış/satış/giderleri otomatik düşer/ekler. (Önerilen ilk kullanım)',
  },
};

const CapitalModal = ({ isOpen, onClose }) => {
  const { capital, adjustCapital, setCapitalAmount, initializeCapital } = useApp();
  const [mode, setMode] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  const currentAmount = Number(capital?.amount || 0);
  const modes = useMemo(() => ['deposit', 'withdrawal', 'set', 'initialize'], []);

  const handleClose = () => {
    setMode('deposit');
    setAmount('');
    setDescription('');
    setError('');
    setSuccessInfo(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numeric = parseNumber(amount);
    if (numeric < 0 || (mode !== 'initialize' && numeric <= 0)) {
      setError('Geçerli bir tutar giriniz.');
      return;
    }
    if ((mode === 'set' || mode === 'initialize') && numeric < 0) {
      setError('Bakiye negatif olamaz.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (mode === 'set') {
        await setCapitalAmount(numeric, description);
        handleClose();
      } else if (mode === 'initialize') {
        const result = await initializeCapital(numeric, description);
        // Detay göster
        setSuccessInfo({
          starting: numeric,
          netDelta: Number(result?.net_delta_from_history || 0),
          applied: Number(result?.applied_transactions || 0),
          finalAmount: Number(result?.amount || 0),
        });
        setAmount('');
      } else {
        await adjustCapital(numeric, mode, description);
        handleClose();
      }
    } catch (err) {
      const msg = err?.response?.data?.detail?.message || err?.response?.data?.detail || 'İşlem başarısız oldu.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
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

        {successInfo ? (
          // ✅ İlk Kurulum başarılı sonuç ekranı
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-success/40 bg-success/10 p-4">
              <div className="text-sm font-semibold text-success mb-2">İlk Kurulum Tamamlandı ✓</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Başlangıç Sermayesi</span><span className="font-semibold">{formatCurrency(successInfo.starting)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geçmiş Net Hareket</span>
                  <span className={successInfo.netDelta >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                    {successInfo.netDelta >= 0 ? '+' : ''}{formatCurrency(successInfo.netDelta)}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Uygulanan İşlem</span><span>{successInfo.applied}</span></div>
                <div className="border-t border-success/20 mt-2 pt-2 flex justify-between text-base">
                  <span className="font-semibold">Mevcut Bakiye</span>
                  <span className="font-bold text-primary">{formatCurrency(successInfo.finalAmount)}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold"
            >
              Tamam
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {modes.map((m) => {
                const meta = TYPE_META[m];
                const Icon = meta.icon;
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(''); }}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                    data-testid={`capital-mode-${m}`}
                  >
                    <Icon size={20} className={active ? meta.color : ''} />
                    <span className="text-[11px] leading-tight text-center">{meta.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">{TYPE_META[mode].hint}</p>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {mode === 'set' ? 'Yeni Bakiye' : mode === 'initialize' ? 'Başlangıç Sermayesi' : 'Tutar'} (₺)
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
              {mode === 'initialize' && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Örn: 15M girersiniz, sistemde önceden 10M'lik araç alış'ı varsa kasa otomatik 5M olur.
                </p>
              )}
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CapitalModal;
