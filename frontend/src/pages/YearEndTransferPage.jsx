import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { yearEndAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import {
  CalendarClock,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  History
} from 'lucide-react';

const YearEndTransferPage = () => {
  const { transactions, fetchData } = useApp();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Fetch transfer history
  useEffect(() => {
    yearEndAPI.getTransfers()
      .then(res => setTransfers(res.data || []))
      .catch(() => {});
  }, []);

  // Available years from transactions
  const availableYears = useMemo(() => {
    const years = new Set();
    const currentYear = new Date().getFullYear();
    transactions.filter(t => !t.deleted).forEach(t => {
      if (t.date) {
        const y = parseInt(t.date.substring(0, 4));
        if (y >= 2020 && y <= currentYear) years.add(y);
      }
    });
    if (years.size === 0) years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Check if selected year already transferred
  const isAlreadyTransferred = transfers.some(t => t.year === selectedYear);

  // Calculate year summary
  const yearSummary = useMemo(() => {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const yearTxs = transactions.filter(
      t => !t.deleted && t.date >= yearStart && t.date <= yearEnd && t.category !== 'Devir Bakiye'
    );

    const carryoverTxs = transactions.filter(
      t => !t.deleted && t.date >= yearStart && t.date <= yearEnd && t.category === 'Devir Bakiye'
    );

    const income = yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const expense = yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const carryover = carryoverTxs.reduce(
      (s, t) => s + (t.type === 'income' ? t.amount || 0 : -(t.amount || 0)), 0
    );

    return {
      income,
      expense,
      net: income - expense,
      carryover,
      total: income - expense + carryover,
      txCount: yearTxs.length
    };
  }, [transactions, selectedYear]);

  const handleTransfer = async () => {
    setTransferring(true);
    try {
      const res = await yearEndAPI.createTransfer(selectedYear);
      setTransfers(prev => [res.data, ...prev]);
      setConfirmOpen(false);
      await fetchData();
    } catch (e) {
      const msg = e.response?.data?.detail || 'Devir islemi basarisiz';
      alert(msg);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/20">
          <CalendarClock size={22} className="text-primary" />
        </div>
        <div>
          <h2 className="font-heading font-bold text-xl">Yil Sonu Devri</h2>
          <p className="text-sm text-muted-foreground">Yil sonu kasa bakiyesini yeni yila aktarin</p>
        </div>
      </div>

      {/* Year Selector */}
      <div className="bg-card border border-border rounded-xl p-5">
        <label className="text-sm text-muted-foreground mb-2 block">Devir Yili Secin</label>
        <div className="flex gap-2 flex-wrap">
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => { setSelectedYear(y); setConfirmOpen(false); }}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                selectedYear === y
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              }`}
              data-testid={`year-btn-${y}`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Year Financial Summary */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-heading font-semibold text-lg">{selectedYear} Mali Ozeti</h3>
        <p className="text-xs text-muted-foreground">{yearSummary.txCount} islem</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-success/10 border border-success/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-success" />
              <span className="text-xs text-muted-foreground">Toplam Gelir</span>
            </div>
            <p className="font-bold text-lg text-success tabular-nums" data-testid="year-income">
              {formatCurrency(yearSummary.income)}
            </p>
          </div>

          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={16} className="text-destructive" />
              <span className="text-xs text-muted-foreground">Toplam Gider</span>
            </div>
            <p className="font-bold text-lg text-destructive tabular-nums" data-testid="year-expense">
              {formatCurrency(yearSummary.expense)}
            </p>
          </div>
        </div>

        {yearSummary.carryover !== 0 && (
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowRightLeft size={16} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Onceki Devir Bakiye</span>
            </div>
            <p className={`font-bold text-lg tabular-nums ${yearSummary.carryover >= 0 ? 'text-success' : 'text-destructive'}`}>
              {yearSummary.carryover >= 0 ? '+' : ''}{formatCurrency(yearSummary.carryover)}
            </p>
          </div>
        )}

        <div className={`border-2 rounded-lg p-4 ${yearSummary.total >= 0 ? 'border-primary/40 bg-primary/5' : 'border-destructive/40 bg-destructive/5'}`}>
          <div className="flex items-center gap-2 mb-1">
            <ArrowRightLeft size={16} className={yearSummary.total >= 0 ? 'text-primary' : 'text-destructive'} />
            <span className="text-xs text-muted-foreground">Devredilecek Bakiye ({selectedYear + 1} yilina)</span>
          </div>
          <p className={`font-heading font-bold text-2xl tabular-nums ${yearSummary.total >= 0 ? 'text-primary' : 'text-destructive'}`} data-testid="transfer-balance">
            {formatCurrency(yearSummary.total)}
          </p>
        </div>
      </div>

      {/* Transfer Action */}
      <div className="bg-card border border-border rounded-xl p-5">
        {isAlreadyTransferred ? (
          <div className="flex items-center gap-3 text-success">
            <CheckCircle2 size={22} />
            <div>
              <p className="font-medium">{selectedYear} devri tamamlanmis</p>
              <p className="text-sm text-muted-foreground">
                Bu yilin devir islemi daha once yapildi.
              </p>
            </div>
          </div>
        ) : !confirmOpen ? (
          <button
            onClick={() => setConfirmOpen(true)}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            data-testid="start-transfer-btn"
          >
            {selectedYear} Yili Devrini Baslat
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-500">Dikkat!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedYear} yili icin <strong>{formatCurrency(yearSummary.total)}</strong> tutarinda devir bakiye,
                  <strong> 01.01.{selectedYear + 1}</strong> tarihli islem olarak kaydedilecek.
                  Bu islem geri alinamaz.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-3 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
                data-testid="cancel-transfer-btn"
              >
                Vazgec
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="confirm-transfer-btn"
              >
                {transferring ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Isleniyor...
                  </>
                ) : (
                  'Devri Onayla'
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transfer History */}
      {transfers.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <History size={18} className="text-muted-foreground" />
            <h3 className="font-heading font-semibold">Devir Gecmisi</h3>
          </div>
          <div className="divide-y divide-border">
            {transfers.map(t => (
              <div key={t.id} className="p-4 flex items-center justify-between" data-testid={`transfer-${t.year}`}>
                <div>
                  <p className="font-medium">{t.year} &rarr; {t.year + 1}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gelir: {formatCurrency(t.total_income)} | Gider: {formatCurrency(t.total_expense)}
                    {t.previous_carryover ? ` | Onceki Devir: ${formatCurrency(t.previous_carryover)}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString('tr-TR')} tarihinde yapildi
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-heading font-bold text-lg tabular-nums ${t.net_balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(t.net_balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.transfer_type === 'income' ? 'Gelir' : 'Gider'} olarak devredildi
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default YearEndTransferPage;
