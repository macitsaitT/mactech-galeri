import React, { useState } from 'react';
import { Calculator, TrendingUp, CreditCard, DollarSign, Percent, Tag, ArrowLeftRight } from 'lucide-react';

const CalculationsPage = () => {
  const [activeCalculator, setActiveCalculator] = useState('sales');

  // Sales Price Simulation
  const [salesCalc, setSalesCalc] = useState({
    purchasePrice: '',
    targetProfit: '',
    expenses: '',
    result: null
  });

  // Installment Calculator
  const [installmentCalc, setInstallmentCalc] = useState({
    price: '',
    downPayment: '',
    months: '12',
    interestRate: '2.5',
    result: null
  });

  // Credit Calculator
  const [creditCalc, setCreditCalc] = useState({
    loanAmount: '',
    months: '12',
    interestRate: '3.5',
    result: null
  });

  // VAT Calculator
  const [vatCalc, setVatCalc] = useState({
    amount: '',
    vatRate: '20',
    includesVat: false,
    result: null
  });

  // Discount Calculator
  const [discountCalc, setDiscountCalc] = useState({
    originalPrice: '',
    discountPercent: '',
    result: null
  });

  // Currency Impact Calculator
  const [currencyCalc, setCurrencyCalc] = useState({
    priceInCurrency: '',
    currentRate: '',
    targetRate: '',
    result: null
  });

  // Profit/Loss Calculator
  const [profitCalc, setProfitCalc] = useState({
    purchasePrice: '',
    expenses: '',
    salePrice: '',
    result: null
  });

  const formatNumber = (num) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const calculateSalesPrice = () => {
    const purchase = parseFloat(salesCalc.purchasePrice) || 0;
    const profit = parseFloat(salesCalc.targetProfit) || 0;
    const expenses = parseFloat(salesCalc.expenses) || 0;
    const suggestedPrice = purchase + profit + expenses;
    setSalesCalc({ ...salesCalc, result: suggestedPrice });
  };

  const calculateInstallment = () => {
    const price = parseFloat(installmentCalc.price) || 0;
    const down = parseFloat(installmentCalc.downPayment) || 0;
    const months = parseInt(installmentCalc.months) || 1;
    const rate = parseFloat(installmentCalc.interestRate) || 0;

    const loanAmount = price - down;
    const monthlyRate = rate / 100;
    const monthlyPayment = (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    const total = monthlyPayment * months + down;

    setInstallmentCalc({
      ...installmentCalc,
      result: {
        monthlyPayment,
        totalPayment: total,
        totalInterest: total - price
      }
    });
  };

  const calculateCredit = () => {
    const loan = parseFloat(creditCalc.loanAmount) || 0;
    const months = parseInt(creditCalc.months) || 1;
    const rate = parseFloat(creditCalc.interestRate) || 0;

    const monthlyRate = rate / 100;
    const monthlyPayment = (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    const total = monthlyPayment * months;

    setCreditCalc({
      ...creditCalc,
      result: {
        monthlyPayment,
        totalPayment: total,
        totalInterest: total - loan
      }
    });
  };

  const calculateVat = () => {
    const amount = parseFloat(vatCalc.amount) || 0;
    const rate = parseFloat(vatCalc.vatRate) / 100;

    let vatAmount, totalAmount, netAmount;

    if (vatCalc.includesVat) {
      // KDV dahil fiyattan hesapla
      totalAmount = amount;
      netAmount = amount / (1 + rate);
      vatAmount = amount - netAmount;
    } else {
      // KDV hariç fiyattan hesapla
      netAmount = amount;
      vatAmount = amount * rate;
      totalAmount = amount + vatAmount;
    }

    setVatCalc({
      ...vatCalc,
      result: { netAmount, vatAmount, totalAmount }
    });
  };

  const calculateDiscount = () => {
    const original = parseFloat(discountCalc.originalPrice) || 0;
    const discount = parseFloat(discountCalc.discountPercent) || 0;

    const discountAmount = original * (discount / 100);
    const finalPrice = original - discountAmount;

    setDiscountCalc({
      ...discountCalc,
      result: { discountAmount, finalPrice, saved: discountAmount }
    });
  };

  const calculateCurrency = () => {
    const priceInCurrency = parseFloat(currencyCalc.priceInCurrency) || 0;
    const current = parseFloat(currencyCalc.currentRate) || 0;
    const target = parseFloat(currencyCalc.targetRate) || 0;

    const currentTL = priceInCurrency * current;
    const targetTL = priceInCurrency * target;
    const difference = targetTL - currentTL;

    setCurrencyCalc({
      ...currencyCalc,
      result: { currentTL, targetTL, difference }
    });
  };

  const calculateProfit = () => {
    const purchase = parseFloat(profitCalc.purchasePrice) || 0;
    const expenses = parseFloat(profitCalc.expenses) || 0;
    const sale = parseFloat(profitCalc.salePrice) || 0;

    const totalCost = purchase + expenses;
    const profitLoss = sale - totalCost;
    const profitMargin = sale > 0 ? (profitLoss / sale) * 100 : 0;

    setProfitCalc({
      ...profitCalc,
      result: {
        totalCost,
        profitLoss,
        profitMargin,
        isProfit: profitLoss >= 0
      }
    });
  };

  const calculators = [
    { id: 'sales', label: 'Satış Fiyatı Simülasyonu', icon: TrendingUp },
    { id: 'installment', label: 'Taksit Hesaplama', icon: Calculator },
    { id: 'credit', label: 'Kredi Hesaplama', icon: CreditCard },
    { id: 'vat', label: 'KDV Hesaplama', icon: Percent },
    { id: 'discount', label: 'İndirim Hesaplama', icon: Tag },
    { id: 'currency', label: 'Kur Etkisi', icon: DollarSign },
    { id: 'profit', label: 'Kar/Zarar Hesaplama', icon: ArrowLeftRight }
  ];

  return (
    <div className="space-y-6">
      {/* Calculator Selection */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {calculators.map((calc) => {
          const Icon = calc.icon;
          const isActive = activeCalculator === calc.id;
          return (
            <button
              key={calc.id}
              onClick={() => setActiveCalculator(calc.id)}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                isActive
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-card border-border hover:border-primary/50'
              }`}
            >
              <Icon size={28} />
              <span className="text-sm font-semibold text-center">{calc.label}</span>
            </button>
          );
        })}
      </div>

      {/* Calculator Forms */}
      <div className="bg-card border border-border rounded-xl p-6">
        {/* Sales Price Simulation */}
        {activeCalculator === 'sales' && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="text-primary" />
              Satış Fiyatı Simülasyonu
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Alış Fiyatı (₺)</label>
                <input
                  type="number"
                  value={salesCalc.purchasePrice}
                  onChange={(e) => setSalesCalc({ ...salesCalc, purchasePrice: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Hedef Kar (₺)</label>
                <input
                  type="number"
                  value={salesCalc.targetProfit}
                  onChange={(e) => setSalesCalc({ ...salesCalc, targetProfit: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Ek Giderler (₺)</label>
                <input
                  type="number"
                  value={salesCalc.expenses}
                  onChange={(e) => setSalesCalc({ ...salesCalc, expenses: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
            </div>
            <button
              onClick={calculateSalesPrice}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90"
            >
              Hesapla
            </button>
            {salesCalc.result !== null && (
              <div className="bg-primary/10 border border-primary rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Önerilen Satış Fiyatı:</p>
                <p className="text-3xl font-bold text-primary">{formatNumber(salesCalc.result)} ₺</p>
              </div>
            )}
          </div>
        )}

        {/* Installment Calculator */}
        {activeCalculator === 'installment' && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Calculator className="text-primary" />
              Taksit Hesaplama
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Araç Fiyatı (₺)</label>
                <input
                  type="number"
                  value={installmentCalc.price}
                  onChange={(e) => setInstallmentCalc({ ...installmentCalc, price: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Peşinat (₺)</label>
                <input
                  type="number"
                  value={installmentCalc.downPayment}
                  onChange={(e) => setInstallmentCalc({ ...installmentCalc, downPayment: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Vade (Ay)</label>
                <select
                  value={installmentCalc.months}
                  onChange={(e) => setInstallmentCalc({ ...installmentCalc, months: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                >
                  {[6, 12, 18, 24, 36, 48, 60].map(m => (
                    <option key={m} value={m}>{m} Ay</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Aylık Faiz Oranı (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={installmentCalc.interestRate}
                  onChange={(e) => setInstallmentCalc({ ...installmentCalc, interestRate: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="2.5"
                />
              </div>
            </div>
            <button
              onClick={calculateInstallment}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90"
            >
              Hesapla
            </button>
            {installmentCalc.result && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-primary/10 border border-primary rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Aylık Taksit:</p>
                  <p className="text-2xl font-bold text-primary">{formatNumber(installmentCalc.result.monthlyPayment)} ₺</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Toplam Ödeme:</p>
                  <p className="text-2xl font-bold">{formatNumber(installmentCalc.result.totalPayment)} ₺</p>
                </div>
                <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Toplam Faiz:</p>
                  <p className="text-2xl font-bold text-destructive">{formatNumber(installmentCalc.result.totalInterest)} ₺</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Credit Calculator */}
        {activeCalculator === 'credit' && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="text-primary" />
              Kredi Hesaplama
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Kredi Tutarı (₺)</label>
                <input
                  type="number"
                  value={creditCalc.loanAmount}
                  onChange={(e) => setCreditCalc({ ...creditCalc, loanAmount: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Vade (Ay)</label>
                <select
                  value={creditCalc.months}
                  onChange={(e) => setCreditCalc({ ...creditCalc, months: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                >
                  {[6, 12, 18, 24, 36, 48, 60].map(m => (
                    <option key={m} value={m}>{m} Ay</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Aylık Faiz Oranı (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={creditCalc.interestRate}
                  onChange={(e) => setCreditCalc({ ...creditCalc, interestRate: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="3.5"
                />
              </div>
            </div>
            <button
              onClick={calculateCredit}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90"
            >
              Hesapla
            </button>
            {creditCalc.result && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-primary/10 border border-primary rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Aylık Ödeme:</p>
                  <p className="text-2xl font-bold text-primary">{formatNumber(creditCalc.result.monthlyPayment)} ₺</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Toplam Geri Ödeme:</p>
                  <p className="text-2xl font-bold">{formatNumber(creditCalc.result.totalPayment)} ₺</p>
                </div>
                <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Toplam Faiz:</p>
                  <p className="text-2xl font-bold text-destructive">{formatNumber(creditCalc.result.totalInterest)} ₺</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VAT Calculator */}
        {activeCalculator === 'vat' && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Percent className="text-primary" />
              KDV Hesaplama
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tutar (₺)</label>
                <input
                  type="number"
                  value={vatCalc.amount}
                  onChange={(e) => setVatCalc({ ...vatCalc, amount: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">KDV Oranı (%)</label>
                <select
                  value={vatCalc.vatRate}
                  onChange={(e) => setVatCalc({ ...vatCalc, vatRate: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                >
                  <option value="1">%1</option>
                  <option value="10">%10</option>
                  <option value="20">%20</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includesVat"
                checked={vatCalc.includesVat}
                onChange={(e) => setVatCalc({ ...vatCalc, includesVat: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="includesVat" className="text-sm">Tutar KDV Dahil</label>
            </div>
            <button
              onClick={calculateVat}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90"
            >
              Hesapla
            </button>
            {vatCalc.result && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Net Tutar:</p>
                  <p className="text-2xl font-bold">{formatNumber(vatCalc.result.netAmount)} ₺</p>
                </div>
                <div className="bg-primary/10 border border-primary rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">KDV Tutarı:</p>
                  <p className="text-2xl font-bold text-primary">{formatNumber(vatCalc.result.vatAmount)} ₺</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">KDV Dahil Toplam:</p>
                  <p className="text-2xl font-bold">{formatNumber(vatCalc.result.totalAmount)} ₺</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Discount Calculator */}
        {activeCalculator === 'discount' && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Tag className="text-primary" />
              İndirim Hesaplama
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Orijinal Fiyat (₺)</label>
                <input
                  type="number"
                  value={discountCalc.originalPrice}
                  onChange={(e) => setDiscountCalc({ ...discountCalc, originalPrice: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">İndirim Oranı (%)</label>
                <input
                  type="number"
                  value={discountCalc.discountPercent}
                  onChange={(e) => setDiscountCalc({ ...discountCalc, discountPercent: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
            </div>
            <button
              onClick={calculateDiscount}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90"
            >
              Hesapla
            </button>
            {discountCalc.result && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">İndirim Tutarı:</p>
                  <p className="text-2xl font-bold text-destructive">{formatNumber(discountCalc.result.discountAmount)} ₺</p>
                </div>
                <div className="bg-primary/10 border border-primary rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">İndirimli Fiyat:</p>
                  <p className="text-2xl font-bold text-primary">{formatNumber(discountCalc.result.finalPrice)} ₺</p>
                </div>
                <div className="bg-success/10 border border-success rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Tasarruf:</p>
                  <p className="text-2xl font-bold text-success">{formatNumber(discountCalc.result.saved)} ₺</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Currency Impact */}
        {activeCalculator === 'currency' && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <DollarSign className="text-primary" />
              Kur Etkisi Hesaplama
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Döviz Cinsinden Fiyat ($)</label>
                <input
                  type="number"
                  value={currencyCalc.priceInCurrency}
                  onChange={(e) => setCurrencyCalc({ ...currencyCalc, priceInCurrency: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Mevcut Kur (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  value={currencyCalc.currentRate}
                  onChange={(e) => setCurrencyCalc({ ...currencyCalc, currentRate: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Hedef Kur (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  value={currencyCalc.targetRate}
                  onChange={(e) => setCurrencyCalc({ ...currencyCalc, targetRate: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0.00"
                />
              </div>
            </div>
            <button
              onClick={calculateCurrency}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90"
            >
              Hesapla
            </button>
            {currencyCalc.result && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Mevcut Kur ile (₺):</p>
                  <p className="text-2xl font-bold">{formatNumber(currencyCalc.result.currentTL)} ₺</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Hedef Kur ile (₺):</p>
                  <p className="text-2xl font-bold">{formatNumber(currencyCalc.result.targetTL)} ₺</p>
                </div>
                <div className={`border rounded-lg p-4 ${
                  currencyCalc.result.difference >= 0 
                    ? 'bg-destructive/10 border-destructive' 
                    : 'bg-success/10 border-success'
                }`}>
                  <p className="text-xs text-muted-foreground mb-1">Fark:</p>
                  <p className={`text-2xl font-bold ${
                    currencyCalc.result.difference >= 0 ? 'text-destructive' : 'text-success'
                  }`}>
                    {currencyCalc.result.difference >= 0 ? '+' : ''}{formatNumber(currencyCalc.result.difference)} ₺
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profit/Loss Calculator */}
        {activeCalculator === 'profit' && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <ArrowLeftRight className="text-primary" />
              Kar/Zarar Hesaplama
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Alış Fiyatı (₺)</label>
                <input
                  type="number"
                  value={profitCalc.purchasePrice}
                  onChange={(e) => setProfitCalc({ ...profitCalc, purchasePrice: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Giderler (₺)</label>
                <input
                  type="number"
                  value={profitCalc.expenses}
                  onChange={(e) => setProfitCalc({ ...profitCalc, expenses: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Satış Fiyatı (₺)</label>
                <input
                  type="number"
                  value={profitCalc.salePrice}
                  onChange={(e) => setProfitCalc({ ...profitCalc, salePrice: e.target.value })}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg"
                  placeholder="0"
                />
              </div>
            </div>
            <button
              onClick={calculateProfit}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90"
            >
              Hesapla
            </button>
            {profitCalc.result && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Toplam Maliyet:</p>
                  <p className="text-2xl font-bold">{formatNumber(profitCalc.result.totalCost)} ₺</p>
                </div>
                <div className={`border rounded-lg p-4 ${
                  profitCalc.result.isProfit 
                    ? 'bg-success/10 border-success' 
                    : 'bg-destructive/10 border-destructive'
                }`}>
                  <p className="text-xs text-muted-foreground mb-1">
                    {profitCalc.result.isProfit ? 'Kar' : 'Zarar'}:
                  </p>
                  <p className={`text-2xl font-bold ${
                    profitCalc.result.isProfit ? 'text-success' : 'text-destructive'
                  }`}>
                    {formatNumber(Math.abs(profitCalc.result.profitLoss))} ₺
                  </p>
                </div>
                <div className="bg-primary/10 border border-primary rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Kar Marjı:</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatNumber(profitCalc.result.profitMargin)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalculationsPage;
