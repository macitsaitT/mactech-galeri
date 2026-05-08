import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileText, Download, Printer, Building2, Package, Tag, Key, Car, Search, Users, TrendingUp, Wallet, CalendarDays } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate, openPrintableHTML } from '../../utils/helpers';
import { fileAPI, usersAPI, capitalAPI } from '../../services/api';
import VehicleExpensesModal from './VehicleExpensesModal';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
// ✅ Refactor: ReportModal alt parçaları ayrı dosyalara çıkarıldı
import { reportTypes, reportTitles, getLogoUrl } from './reportParts/reportConfig';
import { buildPrintHTML } from './reportParts/buildPrintHTML';
import { ExpensesReportBody } from './reportParts/ExpensesReportBody';

const ReportModal = ({ isOpen, onClose }) => {
  const { user, cars, transactions } = useApp();
  const reportRef = useRef(null);

  // ✅ Tarih filtresi kaldırıldı — tüm zamanlar varsayılan.
  // (Yıl Sonu raporu kendi yıl picker'ı ile bu tarihleri override eder.)
  const [startDate, setStartDate] = useState('2000-01-01');
  const [endDate, setEndDate] = useState(() => '2099-12-31');
  const [reportType, setReportType] = useState('general');
  const [plateSearch, setPlateSearch] = useState('');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [employees, setEmployees] = useState([]);
  // ✅ Sermaye raporu için kasa hareketleri
  const [capitalMovements, setCapitalMovements] = useState([]);
  // ✅ Yıl Sonu Raporu için yıl seçimi (tarih aralığını otomatik ayarlar)
  const [yearendYear, setYearendYear] = useState(() => new Date().getFullYear());
  // ✅ Rapor ekranından doğrudan masraf ekleme — VehicleExpensesModal pencere state
  const [expensesFor, setExpensesFor] = useState(null);

  // Yıl Sonu seçildiğinde startDate/endDate'i o yıla otomatik ayarla.
  // Yıl Sonu'ndan başka tipe geçildiğinde "tüm zamanlar" varsayılanına dön.
  useEffect(() => {
    if (reportType === 'yearend') {
      setStartDate(`${yearendYear}-01-01`);
      setEndDate(`${yearendYear}-12-31`);
      // Sermaye hareketlerini de yükle (Yıl Sonu içinde gösterilecek)
      capitalAPI.movements(2000).then(res => setCapitalMovements(res.data?.movements || [])).catch(() => {});
    } else {
      setStartDate('2000-01-01');
      setEndDate('2099-12-31');
    }
  }, [reportType, yearendYear]);

  const userRole = user?.role || 'admin';

  useEffect(() => {
    if (isOpen && (userRole === 'admin' || userRole === 'muhasebe')) {
      usersAPI.getEmployees().then(res => setEmployees(res.data || [])).catch(() => {});
    }
  }, [isOpen, userRole]);

  useEffect(() => {
    if (isOpen && reportType === 'capital') {
      capitalAPI.movements(500)
        .then(res => setCapitalMovements(res.data?.movements || []))
        .catch(() => setCapitalMovements([]));
    }
  }, [isOpen, reportType]);

  const companyName = user?.company_name || 'MACTech';
  const companyPhone = user?.phone || '05401250404';
  const logoPath = user?.logo_url || '';

  const activeCars = useMemo(() => cars.filter(c => !c.deleted), [cars]);

  // Map car_id to sold_by_name for quick lookup in sold report
  const carSoldByMap = useMemo(() => {
    const map = {};
    cars.forEach(c => { if (c.sold_by_name) map[c.id] = c.sold_by_name; });
    return map;
  }, [cars]);

  const filteredCarsForDropdown = useMemo(() => {
    if (!plateSearch) return activeCars;
    return activeCars.filter(c =>
      c.plate?.toLowerCase().includes(plateSearch.toLowerCase())
    );
  }, [activeCars, plateSearch]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.deleted) return false;
      const txDate = new Date(t.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59);
      return txDate >= start && txDate <= end;
    });
  }, [transactions, startDate, endDate]);

  const displayTransactions = useMemo(() => {
    let filtered = [...filteredTransactions];

    // Employee filter
    if (selectedEmployee !== 'all') {
      filtered = filtered.filter(t => t.created_by === selectedEmployee);
    }

    switch (reportType) {
      case 'stock':
        filtered = filtered.filter(t => t.category?.includes('Alımı') || t.category?.includes('Alış'));
        break;
      case 'sold':
        filtered = filtered.filter(t =>
          t.category?.includes('Satış') ||
          (t.car_id && (t.category === 'Çalışan Payı' || t.category === 'Araç Sahibine Ödeme'))
        );
        break;
      case 'deposit':
        filtered = filtered.filter(t => t.category?.includes('Kapora'));
        break;
      case 'business':
        filtered = filtered.filter(t => !t.car_id);
        break;
      case 'general':
        // ✅ Genel raporda da opsiyonel araç filtresi (boşsa tüm işlemler)
        if (selectedCarId) {
          filtered = filtered.filter(t => t.car_id === selectedCarId);
        }
        break;
      case 'car':
        if (selectedCarId) {
          filtered = filtered.filter(t => t.car_id === selectedCarId);
        }
        break;
      default:
        break;
    }
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filteredTransactions, reportType, selectedCarId, selectedEmployee]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    displayTransactions.forEach(tx => {
      if (tx.type === 'income') income += tx.amount || 0;
      else expense += tx.amount || 0;
    });
    return { income, expense, net: income - expense };
  }, [displayTransactions]);

  const profitMargin = totals.income > 0 ? ((totals.net / totals.income) * 100).toFixed(0) : 0;

  // Split transactions for general report
  const vehicleTransactions = useMemo(() =>
    displayTransactions.filter(t => t.car_id), [displayTransactions]);
  const businessTransactions = useMemo(() =>
    displayTransactions.filter(t => !t.car_id), [displayTransactions]);

  const vehicleTotals = useMemo(() => {
    let income = 0, expense = 0;
    vehicleTransactions.forEach(tx => { if (tx.type === 'income') income += tx.amount || 0; else expense += tx.amount || 0; });
    return { income, expense, net: income - expense };
  }, [vehicleTransactions]);

  const businessTotals = useMemo(() => {
    let income = 0, expense = 0;
    businessTransactions.forEach(tx => { if (tx.type === 'income') income += tx.amount || 0; else expense += tx.amount || 0; });
    return { income, expense, net: income - expense };
  }, [businessTransactions]);

  const activeTransactions = useMemo(() => transactions.filter(t => !t.deleted), [transactions]);

  // Profit/Loss report data: sold cars with their expenses
  const profitLossData = useMemo(() => {
    if (reportType !== 'profitloss') return [];
    const soldCars = activeCars.filter(c => 
      c.status === 'Satıldı' && c.sold_date && c.sold_date >= startDate && c.sold_date <= endDate
    );
    return soldCars.map(car => {
      // ✅ Araç Alımı kategorisi purchase_price'da zaten sayılıyor → çift sayımı önle
      const carExpenses = activeTransactions.filter(t =>
        t.car_id === car.id &&
        t.type === 'expense' &&
        t.category !== 'Araç Alımı' &&
        t.category !== 'Araç Sahibine Ödeme'
      ).reduce((s, t) => s + (t.amount || 0), 0);
      const purchasePrice = car.purchase_price || 0;
      const salePrice = car.sale_price || 0;
      const totalCost = purchasePrice + carExpenses;
      const profit = salePrice - totalCost;
      const stockDays = car.entry_date && car.sold_date
        ? Math.max(0, Math.floor((new Date(car.sold_date) - new Date(car.entry_date)) / (1000*60*60*24)))
        : 0;
      return {
        id: car.id,
        brand: car.brand,
        model: car.model,
        plate: car.plate,
        purchasePrice,
        salePrice,
        carExpenses,
        totalCost,
        profit,
        stockDays,
        sold_date: car.sold_date,
        sold_by_name: car.sold_by_name || '-',
      };
    }).sort((a, b) => new Date(b.sold_date) - new Date(a.sold_date));
  }, [reportType, activeCars, activeTransactions, startDate, endDate]);

  const profitLossTotals = useMemo(() => {
    if (profitLossData.length === 0) return { totalPurchase: 0, totalSale: 0, totalExpenses: 0, totalProfit: 0 };
    return profitLossData.reduce((acc, c) => ({
      totalPurchase: acc.totalPurchase + c.purchasePrice,
      totalSale: acc.totalSale + c.salePrice,
      totalExpenses: acc.totalExpenses + c.carExpenses,
      totalProfit: acc.totalProfit + c.profit,
    }), { totalPurchase: 0, totalSale: 0, totalExpenses: 0, totalProfit: 0 });
  }, [profitLossData]);

  // ✅ Sermaye raporu — tarih aralığında kalan kasa hareketleri
  const capitalRows = useMemo(() => {
    if (reportType !== 'capital') return [];
    return capitalMovements.filter(m => {
      const d = (m.created_at || '').slice(0, 10);
      return d && d >= startDate && d <= endDate;
    });
  }, [capitalMovements, reportType, startDate, endDate]);

  const capitalTotals = useMemo(() => {
    let inflow = 0, outflow = 0;
    capitalRows.forEach(m => {
      const v = Number(m.delta || 0);
      if (v > 0) inflow += v; else outflow += Math.abs(v);
    });
    const lastBalance = capitalRows.length > 0 ? Number(capitalRows[0].balance_after || 0) : 0;
    return { inflow, outflow, net: inflow - outflow, lastBalance };
  }, [capitalRows]);

  // ✅ Yıl Sonu Raporu — kapsamlı yıl özeti
  const yearendData = useMemo(() => {
    if (reportType !== 'yearend') return null;
    const yStart = `${yearendYear}-01-01`;
    const yEnd = `${yearendYear}-12-31`;

    // O yıl içinde satılan araçlar
    const soldCars = activeCars.filter(c =>
      c.status === 'Satıldı' && c.sold_date && c.sold_date >= yStart && c.sold_date <= yEnd
    );
    const carRows = soldCars.map(car => {
      const carExpenses = activeTransactions.filter(t =>
        t.car_id === car.id &&
        t.type === 'expense' &&
        t.category !== 'Araç Alımı' &&
        t.category !== 'Araç Sahibine Ödeme' &&
        t.category !== 'Çalışan Payı'
      ).reduce((s, t) => s + (t.amount || 0), 0);
      const employeeShare = activeTransactions.filter(t =>
        t.car_id === car.id && t.type === 'expense' && t.category === 'Çalışan Payı'
      ).reduce((s, t) => s + (t.amount || 0), 0);
      const purchasePrice = car.ownership === 'stock' ? Number(car.purchase_price || 0) : 0;
      const ownerPay = activeTransactions.filter(t =>
        t.car_id === car.id && t.type === 'expense' && t.category === 'Araç Sahibine Ödeme'
      ).reduce((s, t) => s + (t.amount || 0), 0);
      const totalCost = purchasePrice + ownerPay + carExpenses + employeeShare;
      const salePrice = Number(car.sale_price || 0);
      const profit = salePrice - totalCost;
      return {
        id: car.id,
        plate: car.plate,
        brand: car.brand,
        model: car.model,
        year: car.year,
        sold_date: car.sold_date,
        purchasePrice,
        ownerPay,
        carExpenses,
        employeeShare,
        totalCost,
        salePrice,
        profit,
        ownership: car.ownership,
        sold_by_name: car.sold_by_name || '-',
      };
    }).sort((a, b) => new Date(a.sold_date) - new Date(b.sold_date));

    // Yıl içinde tüm transactions
    const yTx = activeTransactions.filter(t => t.date && t.date >= yStart && t.date <= yEnd);
    const businessExpense = yTx
      .filter(t => t.type === 'expense' && !t.car_id)
      .reduce((s, t) => s + (t.amount || 0), 0);
    const businessIncome = yTx
      .filter(t => t.type === 'income' && !t.car_id)
      .reduce((s, t) => s + (t.amount || 0), 0);

    const totals = carRows.reduce((acc, c) => ({
      sold: acc.sold + 1,
      purchase: acc.purchase + c.purchasePrice + c.ownerPay,
      sales: acc.sales + c.salePrice,
      carExpenses: acc.carExpenses + c.carExpenses,
      employeeShare: acc.employeeShare + c.employeeShare,
      grossProfit: acc.grossProfit + c.profit,
    }), { sold: 0, purchase: 0, sales: 0, carExpenses: 0, employeeShare: 0, grossProfit: 0 });

    const netResult = totals.grossProfit + businessIncome - businessExpense;

    // Stokta kalan araçlar (yıl sonu)
    const remainingStock = activeCars.filter(c =>
      c.status !== 'Satıldı' && c.ownership === 'stock'
    );
    const remainingValue = remainingStock.reduce((s, c) => s + Number(c.purchase_price || 0), 0);

    // Kasa giriş/çıkış (yıl içinde manuel hareketler)
    const yearMovements = (capitalMovements || []).filter(m => {
      const d = (m.created_at || '').slice(0, 10);
      return d && d >= yStart && d <= yEnd;
    });
    const manualInflow = yearMovements.filter(m => m.reason === 'manual_deposit' || m.reason === 'capital_initialize').reduce((s, m) => s + Math.max(0, Number(m.delta || 0)), 0);
    const manualOutflow = yearMovements.filter(m => m.reason === 'manual_withdrawal').reduce((s, m) => s + Math.abs(Number(m.delta || 0)), 0);

    return {
      year: yearendYear,
      carRows,
      totals,
      businessExpense,
      businessIncome,
      netResult,
      remainingStock: remainingStock.length,
      remainingValue,
      manualInflow,
      manualOutflow,
    };
  }, [reportType, yearendYear, activeCars, activeTransactions, capitalMovements]);

  const fetchLogoAsDataUrl = () => {
    return new Promise((resolve) => {
      const url = getLogoUrl(logoPath);
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const doPrint = async () => {
    const logoDataUrl = await fetchLogoAsDataUrl();
    const dateRange = reportType === 'yearend'
      ? `${yearendYear} Yılı`
      : (startDate === '2000-01-01' ? 'Tüm Zamanlar' : `${formatDate(startDate)} - ${formatDate(endDate)}`);
    const empName = selectedEmployee !== 'all' ? employees.find(e => e.id === selectedEmployee)?.name : null;
    const title = empName ? `${reportTitles[reportType]} - ${empName}` : reportTitles[reportType];
    const html = buildPrintHTML({
      title,
      dateRange,
      companyName,
      phone: companyPhone,
      logoDataUrl,
      totals,
      profitMargin,
      displayTransactions,
      formatCurrency,
      formatDate,
      reportType,
      carSoldByMap,
    });
    openPrintableHTML(html);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-0.5rem)] sm:w-[calc(100vw-1.5rem)] sm:max-w-5xl max-h-[95vh] sm:max-h-[92vh] overflow-hidden flex flex-col p-3 sm:p-6" data-testid="report-modal">
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between pb-1 sm:pb-2 pr-8">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText size={18} className="text-primary" />
            Rapor Oluşturucu
          </DialogTitle>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={doPrint}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-destructive text-destructive-foreground rounded-lg flex items-center gap-1.5 text-xs sm:text-sm font-semibold hover:bg-destructive/90 transition-colors"
              data-testid="download-pdf-btn"
            >
              <Download size={14} />
              PDF
            </button>
            <button
              onClick={doPrint}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-amber-500 text-white rounded-lg flex items-center gap-1.5 text-xs sm:text-sm font-semibold hover:bg-amber-600 transition-colors"
              data-testid="print-btn"
            >
              <Printer size={14} />
              Yazdır
            </button>
          </div>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-2 sm:space-y-3 py-2 sm:py-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2 sm:gap-3">
            {/* Tarih aralığı filtresi kaldırıldı (kullanıcı isteği). Tüm raporlar artık
                tüm zamanlar üzerinden hesaplanır. Yıl Sonu raporu kendi yıl picker'ını kullanır. */}
            {(userRole === 'admin' || userRole === 'muhasebe') && employees.length > 1 && (
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase block mb-1">Çalışan</span>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="h-9 px-3 bg-background border border-border rounded-lg text-sm min-w-[180px]"
                  data-testid="report-employee-filter"
                >
                  <option value="all">Tüm Çalışanlar</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role === 'admin' ? 'Admin' : emp.role === 'muhasebe' ? 'Muhasebe' : 'Satış'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground tracking-wider uppercase block mb-0.5 sm:mb-1">Rapor Kapsamı</span>
              <div className="flex flex-wrap gap-1">
                {reportTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => { setReportType(type.id); if (type.id !== 'car' && type.id !== 'general') { setSelectedCarId(''); setPlateSearch(''); } }}
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors flex items-center gap-1 sm:gap-1.5 ${
                        reportType === type.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border hover:bg-muted text-foreground'
                      }`}
                      data-testid={`report-type-${type.id}`}
                    >
                      <Icon size={12} className="sm:w-3.5 sm:h-3.5" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {(reportType === 'car' || reportType === 'general' || reportType === 'expenses') && (
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase block mb-1">Plaka Ara</span>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={plateSearch} onChange={(e) => setPlateSearch(e.target.value)} placeholder="34 ABC 123" className="h-9 pl-8 pr-3 bg-background border border-border rounded-lg text-sm w-36" data-testid="plate-search-input" />
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase block mb-1">
                  {reportType === 'general' ? 'Araç Filtresi (opsiyonel)' : 'Araç Seç'}
                </span>
                <div className="flex gap-2">
                  <select value={selectedCarId} onChange={(e) => setSelectedCarId(e.target.value)} className="h-9 px-3 bg-background border border-border rounded-lg text-sm flex-1" data-testid="car-select-dropdown">
                    <option value="">{reportType === 'general' ? `-- Tüm Araçlar (${filteredCarsForDropdown.length}) --` : `-- Araç Seçiniz (${filteredCarsForDropdown.length} araç) --`}</option>
                    {filteredCarsForDropdown.map((car) => (
                      <option key={car.id} value={car.id}>{car.plate?.toUpperCase()} - {car.brand} {car.model} ({car.year})</option>
                    ))}
                  </select>
                  {selectedCarId && (() => {
                    const car = activeCars.find(c => c.id === selectedCarId);
                    if (!car) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => setExpensesFor(car)}
                        className="h-9 px-3 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                        data-testid="report-add-expense-btn"
                        title="Bu araca masraf ekle / düzenle"
                      >
                        <Plus size={14} /> Masraf Ekle
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Report Preview */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4" ref={reportRef}>
          <div className="flex justify-between items-start mb-4 sm:mb-6">
            <div>
              <h2 className="text-base sm:text-xl font-bold">
                {reportTitles[reportType]}
                {selectedEmployee !== 'all' && employees.find(e => e.id === selectedEmployee) && (
                  <span className="text-primary"> - {employees.find(e => e.id === selectedEmployee).name}</span>
                )}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {reportType === 'yearend' ? `${yearendYear} Yılı` : (startDate === '2000-01-01' ? 'Tüm Zamanlar' : `${formatDate(startDate)} - ${formatDate(endDate)}`)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {logoPath ? (
                <img src={getLogoUrl(logoPath)} alt="Logo" className="h-8 sm:h-14 w-auto object-contain rounded" crossOrigin="anonymous" />
              ) : (
                <div className="text-right hidden sm:block">
                  <h3 className="text-xl font-bold">{companyName}</h3>
                  <p className="text-sm text-muted-foreground">{companyPhone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Profit/Loss Summary (shown when profitloss type) */}
          {reportType === 'profitloss' ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Toplam Alış</p>
                  <p className="text-sm sm:text-xl font-bold">{formatCurrency(profitLossTotals.totalPurchase)}</p>
                </div>
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Toplam Satış</p>
                  <p className="text-sm sm:text-xl font-bold text-success">{formatCurrency(profitLossTotals.totalSale)}</p>
                </div>
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Araç Giderleri</p>
                  <p className="text-sm sm:text-xl font-bold text-destructive">{formatCurrency(profitLossTotals.totalExpenses)}</p>
                </div>
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center" data-testid="profitloss-total">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Net Kâr/Zarar</p>
                  <p className={`text-sm sm:text-xl font-bold ${profitLossTotals.totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(profitLossTotals.totalProfit)}
                  </p>
                </div>
              </div>

              <div className="mb-4 sm:mb-6">
                <h3 className="font-semibold mb-2 sm:mb-3 border-b border-border pb-2 text-sm sm:text-base">
                  Araç Bazlı Kâr/Zarar ({profitLossData.length} araç)
                </h3>
                {/* Mobile cards for profitloss */}
                <div className="sm:hidden space-y-2">
                  {profitLossData.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground text-sm">Satılan araç bulunamadı.</p>
                  ) : profitLossData.map(car => (
                    <div key={car.id} className="p-3 border border-border rounded-lg">
                      <div className="flex justify-between items-start mb-1.5">
                        <div>
                          <p className="text-xs font-semibold">{car.brand} {car.model}</p>
                          <p className="text-[10px] text-muted-foreground">{car.plate?.toUpperCase()} - {car.stockDays} gün</p>
                        </div>
                        <p className={`text-sm font-bold ${car.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {car.profit >= 0 ? '+' : ''}{formatCurrency(car.profit)}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[10px]">
                        <div><span className="text-muted-foreground">Alış:</span> <span className="font-medium">{formatCurrency(car.purchasePrice)}</span></div>
                        <div><span className="text-muted-foreground">Satış:</span> <span className="text-success font-medium">{formatCurrency(car.salePrice)}</span></div>
                        <div><span className="text-muted-foreground">Gider:</span> <span className="text-destructive font-medium">{car.carExpenses > 0 ? formatCurrency(car.carExpenses) : '-'}</span></div>
                      </div>
                      {car.sold_by_name && <p className="text-[10px] text-muted-foreground mt-1">Satan: {car.sold_by_name}</p>}
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full border-collapse min-w-[700px]" data-testid="profitloss-table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Araç</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Plaka</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Alış</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Giderler</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Maliyet</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Satış</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Kâr/Zarar</th>
                        <th className="text-center p-3 text-sm font-medium text-muted-foreground">Gün</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Satan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitLossData.length === 0 ? (
                        <tr><td colSpan={9} className="text-center p-8 text-muted-foreground">Bu tarih aralığında satılan araç bulunamadı.</td></tr>
                      ) : (
                        profitLossData.map(car => (
                          <tr key={car.id} className="border-b border-border hover:bg-muted/30">
                            <td className="p-3 text-sm font-medium">{car.brand} {car.model}</td>
                            <td className="p-3 text-sm text-muted-foreground">{car.plate?.toUpperCase()}</td>
                            <td className="p-3 text-sm text-right tabular-nums">{formatCurrency(car.purchasePrice)}</td>
                            <td className="p-3 text-sm text-right tabular-nums text-destructive">{car.carExpenses > 0 ? formatCurrency(car.carExpenses) : '-'}</td>
                            <td className="p-3 text-sm text-right tabular-nums font-medium">{formatCurrency(car.totalCost)}</td>
                            <td className="p-3 text-sm text-right tabular-nums text-success font-medium">{formatCurrency(car.salePrice)}</td>
                            <td className={`p-3 text-sm text-right tabular-nums font-bold ${car.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {car.profit >= 0 ? '+' : ''}{formatCurrency(car.profit)}
                            </td>
                            <td className="p-3 text-sm text-center tabular-nums">{car.stockDays}</td>
                            <td className="p-3 text-sm">{car.sold_by_name}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {profitLossData.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-border bg-muted/30 font-bold">
                          <td className="p-3 text-sm" colSpan={2}>TOPLAM</td>
                          <td className="p-3 text-sm text-right tabular-nums">{formatCurrency(profitLossTotals.totalPurchase)}</td>
                          <td className="p-3 text-sm text-right tabular-nums text-destructive">{formatCurrency(profitLossTotals.totalExpenses)}</td>
                          <td className="p-3 text-sm text-right tabular-nums">{formatCurrency(profitLossTotals.totalPurchase + profitLossTotals.totalExpenses)}</td>
                          <td className="p-3 text-sm text-right tabular-nums text-success">{formatCurrency(profitLossTotals.totalSale)}</td>
                          <td className={`p-3 text-sm text-right tabular-nums ${profitLossTotals.totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {profitLossTotals.totalProfit >= 0 ? '+' : ''}{formatCurrency(profitLossTotals.totalProfit)}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
          ) : reportType === 'capital' ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Kasa Girişi</p>
                  <p className="text-sm sm:text-xl font-bold text-success">+{formatCurrency(capitalTotals.inflow)}</p>
                </div>
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Kasa Çıkışı</p>
                  <p className="text-sm sm:text-xl font-bold text-destructive">-{formatCurrency(capitalTotals.outflow)}</p>
                </div>
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Net Akış</p>
                  <p className={`text-sm sm:text-xl font-bold ${capitalTotals.net >= 0 ? 'text-success' : 'text-destructive'}`}>{capitalTotals.net >= 0 ? '+' : ''}{formatCurrency(capitalTotals.net)}</p>
                </div>
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Son Bakiye</p>
                  <p className="text-sm sm:text-xl font-bold">{formatCurrency(capitalTotals.lastBalance)}</p>
                </div>
              </div>

              <div className="mb-4 sm:mb-6">
                <h3 className="font-semibold mb-2 sm:mb-3 border-b border-border pb-2 text-sm sm:text-base flex items-center gap-2">
                  <Wallet size={16} className="text-primary" /> Kasa Hareketleri ({capitalRows.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[600px]" data-testid="capital-table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-muted-foreground">Tarih</th>
                        <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-muted-foreground">Tür</th>
                        <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-muted-foreground">Açıklama</th>
                        <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-medium text-muted-foreground">Tutar</th>
                        <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-medium text-muted-foreground">Bakiye</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capitalRows.length === 0 ? (
                        <tr><td colSpan={5} className="text-center p-6 text-muted-foreground text-sm">Bu tarih aralığında kasa hareketi bulunamadı.</td></tr>
                      ) : capitalRows.map((m) => (
                        <tr key={m.id} className="border-b border-border hover:bg-muted/30">
                          <td className="p-2 sm:p-3 text-xs sm:text-sm">{formatDate((m.created_at || '').slice(0, 10))}</td>
                          <td className="p-2 sm:p-3 text-xs sm:text-sm">{({
                            manual_deposit: 'Kasa Girişi',
                            manual_withdrawal: 'Kasa Çıkışı',
                            manual_set: 'Bakiye Düzenleme',
                            capital_initialize: 'İlk Kurulum',
                            transaction_create: 'İşlem',
                            transaction_update: 'Güncelleme',
                            transaction_delete: 'İşlem Silme',
                            transaction_restore: 'Geri Yükleme',
                            employee_share_sync: 'Çalışan Payı',
                            employee_share_create: 'Çalışan Payı',
                            manual_movement_delete: 'Manuel Silme',
                          }[m.reason]) || m.reason}</td>
                          <td className="p-2 sm:p-3 text-xs sm:text-sm text-muted-foreground truncate max-w-xs">{m.description || '-'}</td>
                          <td className={`p-2 sm:p-3 text-xs sm:text-sm text-right tabular-nums font-semibold ${m.delta >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {m.delta >= 0 ? '+' : ''}{formatCurrency(m.delta)}
                          </td>
                          <td className="p-2 sm:p-3 text-xs sm:text-sm text-right tabular-nums">{formatCurrency(m.balance_after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : reportType === 'yearend' && yearendData ? (
            <>
              {/* Yıl seçici */}
              <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
                <div className="flex items-center gap-2" data-testid="yearend-year-picker">
                  <CalendarDays size={18} className="text-primary" />
                  <span className="text-sm font-semibold text-muted-foreground">Yıl:</span>
                  <select
                    value={yearendYear}
                    onChange={(e) => setYearendYear(Number(e.target.value))}
                    className="h-9 px-3 bg-background border border-border rounded-lg text-sm font-bold"
                    data-testid="yearend-year-select"
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-muted-foreground">
                  Vergi/muhasebeci için yıllık kapanış özeti — direkt yazdırılabilir
                </div>
              </div>

              {/* Üst Özet Kartları */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6" data-testid="yearend-summary-cards">
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Satılan Araç</p>
                  <p className="text-sm sm:text-xl font-bold">{yearendData.totals.sold}</p>
                </div>
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Toplam Satış</p>
                  <p className="text-sm sm:text-xl font-bold text-success">{formatCurrency(yearendData.totals.sales)}</p>
                </div>
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Toplam Maliyet</p>
                  <p className="text-sm sm:text-xl font-bold text-destructive">{formatCurrency(yearendData.totals.purchase + yearendData.totals.carExpenses + yearendData.totals.employeeShare)}</p>
                </div>
                <div className="p-2 sm:p-4 border border-border rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Brüt Kâr</p>
                  <p className={`text-sm sm:text-xl font-bold ${yearendData.totals.grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(yearendData.totals.grossProfit)}
                  </p>
                </div>
              </div>

              {/* İşletme Net Sonucu */}
              <div className="mb-4 sm:mb-6 p-4 border-2 border-primary/40 bg-primary/5 rounded-xl" data-testid="yearend-net-result">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-heading font-bold text-base sm:text-lg flex items-center gap-2">
                      <CalendarDays size={20} className="text-primary" /> {yearendData.year} Net İşletme Sonucu
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Brüt Kâr {formatCurrency(yearendData.totals.grossProfit)} + İşletme Geliri {formatCurrency(yearendData.businessIncome)} − İşletme Gideri {formatCurrency(yearendData.businessExpense)}
                    </p>
                  </div>
                  <div className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${yearendData.netResult >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {yearendData.netResult >= 0 ? '+' : ''}{formatCurrency(yearendData.netResult)}
                  </div>
                </div>
              </div>

              {/* Detay 4'lü grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6 text-xs sm:text-sm">
                <div className="p-2.5 border border-border rounded-lg">
                  <p className="text-[10px] uppercase text-muted-foreground">Çalışan Payı</p>
                  <p className="font-bold text-destructive">{formatCurrency(yearendData.totals.employeeShare)}</p>
                </div>
                <div className="p-2.5 border border-border rounded-lg">
                  <p className="text-[10px] uppercase text-muted-foreground">Araç Giderleri</p>
                  <p className="font-bold text-destructive">{formatCurrency(yearendData.totals.carExpenses)}</p>
                </div>
                <div className="p-2.5 border border-border rounded-lg">
                  <p className="text-[10px] uppercase text-muted-foreground">İşletme Gideri</p>
                  <p className="font-bold text-destructive">{formatCurrency(yearendData.businessExpense)}</p>
                </div>
                <div className="p-2.5 border border-border rounded-lg">
                  <p className="text-[10px] uppercase text-muted-foreground">İşletme Geliri</p>
                  <p className="font-bold text-success">{formatCurrency(yearendData.businessIncome)}</p>
                </div>
              </div>

              {/* Yıl Sonu Stok */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6 text-xs sm:text-sm">
                <div className="p-3 border border-border rounded-lg">
                  <p className="text-[10px] uppercase text-muted-foreground">Yıl Sonu Stok ({yearendData.remainingStock} araç)</p>
                  <p className="font-bold text-primary text-base">{formatCurrency(yearendData.remainingValue)}</p>
                </div>
                <div className="p-3 border border-border rounded-lg">
                  <p className="text-[10px] uppercase text-muted-foreground">Manuel Kasa Giriş / Çıkış</p>
                  <p className="font-bold text-sm">
                    <span className="text-success">+{formatCurrency(yearendData.manualInflow)}</span>
                    {' / '}
                    <span className="text-destructive">-{formatCurrency(yearendData.manualOutflow)}</span>
                  </p>
                </div>
              </div>

              {/* Satılan Araçlar Detay Tablosu */}
              <div className="mb-4 sm:mb-6">
                <h3 className="font-semibold mb-2 sm:mb-3 border-b border-border pb-2 text-sm sm:text-base flex items-center gap-2">
                  <Tag size={16} className="text-primary" /> Yıl İçinde Satılan Araçlar ({yearendData.carRows.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[800px]" data-testid="yearend-cars-table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 text-xs sm:text-sm font-medium text-muted-foreground">Tarih</th>
                        <th className="text-left p-2 text-xs sm:text-sm font-medium text-muted-foreground">Araç</th>
                        <th className="text-left p-2 text-xs sm:text-sm font-medium text-muted-foreground">Plaka</th>
                        <th className="text-right p-2 text-xs sm:text-sm font-medium text-muted-foreground">Alış</th>
                        <th className="text-right p-2 text-xs sm:text-sm font-medium text-muted-foreground">Giderler</th>
                        <th className="text-right p-2 text-xs sm:text-sm font-medium text-muted-foreground">Çal. Payı</th>
                        <th className="text-right p-2 text-xs sm:text-sm font-medium text-muted-foreground">Satış</th>
                        <th className="text-right p-2 text-xs sm:text-sm font-medium text-muted-foreground">Kâr/Zarar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearendData.carRows.length === 0 ? (
                        <tr><td colSpan={8} className="text-center p-6 text-muted-foreground text-sm">{yearendData.year} yılında satılan araç yok.</td></tr>
                      ) : yearendData.carRows.map(c => (
                        <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                          <td className="p-2 text-xs sm:text-sm">{formatDate(c.sold_date)}</td>
                          <td className="p-2 text-xs sm:text-sm font-medium">{c.brand} {c.model} {c.year ? `(${c.year})` : ''}</td>
                          <td className="p-2 text-xs sm:text-sm text-muted-foreground">{c.plate?.toUpperCase()}</td>
                          <td className="p-2 text-xs sm:text-sm text-right tabular-nums">{formatCurrency(c.purchasePrice + c.ownerPay)}</td>
                          <td className="p-2 text-xs sm:text-sm text-right tabular-nums text-destructive">{c.carExpenses > 0 ? formatCurrency(c.carExpenses) : '-'}</td>
                          <td className="p-2 text-xs sm:text-sm text-right tabular-nums text-destructive">{c.employeeShare > 0 ? formatCurrency(c.employeeShare) : '-'}</td>
                          <td className="p-2 text-xs sm:text-sm text-right tabular-nums text-success">{formatCurrency(c.salePrice)}</td>
                          <td className={`p-2 text-xs sm:text-sm text-right tabular-nums font-bold ${c.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {c.profit >= 0 ? '+' : ''}{formatCurrency(c.profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {yearendData.carRows.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-border bg-muted/30 font-bold">
                          <td className="p-2 text-xs sm:text-sm" colSpan={3}>TOPLAM</td>
                          <td className="p-2 text-xs sm:text-sm text-right tabular-nums">{formatCurrency(yearendData.totals.purchase)}</td>
                          <td className="p-2 text-xs sm:text-sm text-right tabular-nums text-destructive">{formatCurrency(yearendData.totals.carExpenses)}</td>
                          <td className="p-2 text-xs sm:text-sm text-right tabular-nums text-destructive">{formatCurrency(yearendData.totals.employeeShare)}</td>
                          <td className="p-2 text-xs sm:text-sm text-right tabular-nums text-success">{formatCurrency(yearendData.totals.sales)}</td>
                          <td className={`p-2 text-xs sm:text-sm text-right tabular-nums ${yearendData.totals.grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {yearendData.totals.grossProfit >= 0 ? '+' : ''}{formatCurrency(yearendData.totals.grossProfit)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
          ) : reportType === 'expenses' ? (
            <ExpensesReportBody
              activeTransactions={activeTransactions}
              activeCars={activeCars}
              startDate={startDate}
              endDate={endDate}
              selectedCarId={selectedCarId}
              setExpensesFor={setExpensesFor}
              formatDate={formatDate}
            />
          ) : (
          <>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="p-2 sm:p-4 border border-border rounded-lg text-center" data-testid="report-total-income">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Toplam Gelir</p>
              <p className="text-sm sm:text-2xl font-bold text-success">{formatCurrency(totals.income)}</p>
            </div>
            <div className="p-2 sm:p-4 border border-border rounded-lg text-center" data-testid="report-total-expense">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Toplam Gider</p>
              <p className="text-sm sm:text-2xl font-bold text-destructive">{formatCurrency(totals.expense)}</p>
            </div>
            <div className="p-2 sm:p-4 border border-border rounded-lg text-center" data-testid="report-net-profit">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Net Kâr</p>
              <p className="text-sm sm:text-2xl font-bold">{formatCurrency(totals.net)}</p>
              <p className={`text-[10px] sm:text-sm ${totals.net >= 0 ? 'text-success' : 'text-destructive'}`}>%{profitMargin}</p>
            </div>
          </div>

          <div className="mb-4 sm:mb-6">
            {reportType === 'general' ? (
              <>
                {/* Araç İşlemleri Bölümü */}
                <div className="mb-4 sm:mb-6">
                  <h3 className="font-semibold mb-2 sm:mb-3 border-b-2 border-primary/30 pb-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2" data-testid="vehicle-transactions-header">
                    <span className="flex items-center gap-1.5">
                      <Car size={16} className="text-primary" />
                      Araç İşlemleri
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal sm:ml-auto flex gap-2 sm:gap-0">
                      <span>Gelir: <span className="text-success font-medium">{formatCurrency(vehicleTotals.income)}</span></span>
                      <span className="hidden sm:inline"> | </span>
                      <span>Gider: <span className="text-destructive font-medium">{formatCurrency(vehicleTotals.expense)}</span></span>
                    </span>
                  </h3>
                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {vehicleTransactions.length === 0 ? (
                      <p className="text-center py-4 text-muted-foreground text-sm">Araç işlemi bulunamadı.</p>
                    ) : vehicleTransactions.map((tx) => {
                      const txCar = tx.car_id ? activeCars.find(c => c.id === tx.car_id) : null;
                      return (
                        <div key={tx.id} className="p-3 border border-border rounded-lg flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{tx.category}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{tx.description || '-'}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(tx.date)}</p>
                          </div>
                          <p className={`text-sm font-semibold shrink-0 ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </p>
                          {txCar && (
                            <button
                              type="button"
                              onClick={() => setExpensesFor(txCar)}
                              className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 shrink-0"
                              data-testid={`row-add-expense-${tx.id}`}
                              title="Bu araca masraf ekle"
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tarih</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tür</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Kategori</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Açıklama</th>
                          <th className="text-right p-3 text-sm font-medium text-muted-foreground">Tutar</th>
                          <th className="text-right p-3 text-sm font-medium text-muted-foreground w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicleTransactions.length === 0 ? (
                          <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">Bu tarih aralığında araç işlemi bulunamadı.</td></tr>
                        ) : vehicleTransactions.map((tx) => {
                          const txCar = tx.car_id ? activeCars.find(c => c.id === tx.car_id) : null;
                          return (
                            <tr key={tx.id} className="border-b border-border hover:bg-muted/30">
                              <td className="p-3 text-sm">{formatDate(tx.date)}</td>
                              <td className="p-3 text-sm"><span className={tx.type === 'income' ? 'text-success' : 'text-destructive'}>{tx.type === 'income' ? 'Gelir' : 'Gider'}</span></td>
                              <td className="p-3 text-sm">{tx.category}</td>
                              <td className="p-3 text-sm text-muted-foreground">{tx.description || '-'}</td>
                              <td className={`p-3 text-sm text-right font-medium ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</td>
                              <td className="p-3 text-right">
                                {txCar ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpensesFor(txCar)}
                                    className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                    data-testid={`row-add-expense-${tx.id}`}
                                    title="Bu araca masraf ekle / düzenle"
                                  >
                                    <Plus size={14} />
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* İşletme İşlemleri Bölümü */}
                <div>
                  <h3 className="font-semibold mb-2 sm:mb-3 border-b-2 border-amber-500/30 pb-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2" data-testid="business-transactions-header">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={16} className="text-amber-500" />
                      İşletme İşlemleri
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal sm:ml-auto flex gap-2 sm:gap-0">
                      <span>Gelir: <span className="text-success font-medium">{formatCurrency(businessTotals.income)}</span></span>
                      <span className="hidden sm:inline"> | </span>
                      <span>Gider: <span className="text-destructive font-medium">{formatCurrency(businessTotals.expense)}</span></span>
                    </span>
                  </h3>
                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {businessTransactions.length === 0 ? (
                      <p className="text-center py-4 text-muted-foreground text-sm">İşletme işlemi bulunamadı.</p>
                    ) : businessTransactions.map((tx) => (
                      <div key={tx.id} className="p-3 border border-border rounded-lg flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{tx.category}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{tx.description || '-'}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDate(tx.date)}</p>
                        </div>
                        <p className={`text-sm font-semibold shrink-0 ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tarih</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tür</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Kategori</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Açıklama</th>
                          <th className="text-right p-3 text-sm font-medium text-muted-foreground">Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {businessTransactions.length === 0 ? (
                          <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">İşletme işlemi bulunamadı.</td></tr>
                        ) : businessTransactions.map((tx) => (
                          <tr key={tx.id} className="border-b border-border hover:bg-muted/30">
                            <td className="p-3 text-sm">{formatDate(tx.date)}</td>
                            <td className="p-3 text-sm"><span className={tx.type === 'income' ? 'text-success' : 'text-destructive'}>{tx.type === 'income' ? 'Gelir' : 'Gider'}</span></td>
                            <td className="p-3 text-sm">{tx.category}</td>
                            <td className="p-3 text-sm text-muted-foreground">{tx.description || '-'}</td>
                            <td className={`p-3 text-sm text-right font-medium ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-semibold mb-2 sm:mb-3 border-b border-border pb-2 text-sm sm:text-base">İşlem Dökümü</h3>
                {/* Mobile cards */}
                <div className="sm:hidden space-y-2">
                  {displayTransactions.length === 0 ? (
                    <p className="text-center py-6 text-muted-foreground text-sm">Bu tarih aralığında işlem bulunamadı.</p>
                  ) : displayTransactions.map((tx) => (
                    <div key={tx.id} className="p-3 border border-border rounded-lg flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{tx.category}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{tx.description || '-'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-muted-foreground">{formatDate(tx.date)}</p>
                          {reportType === 'sold' && carSoldByMap[tx.car_id] && (
                            <p className="text-[10px] text-primary">{carSoldByMap[tx.car_id]}</p>
                          )}
                        </div>
                      </div>
                      <p className={`text-sm font-semibold shrink-0 ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                <table className="w-full border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tarih</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tür</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Kategori</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Açıklama</th>
                      {reportType === 'sold' && <th className="text-left p-3 text-sm font-medium text-muted-foreground">Satış Elemanı</th>}
                      <th className="text-right p-3 text-sm font-medium text-muted-foreground">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTransactions.length === 0 ? (
                      <tr><td colSpan={reportType === 'sold' ? 6 : 5} className="text-center p-8 text-muted-foreground">Bu tarih aralığında işlem bulunamadı.</td></tr>
                    ) : (
                      displayTransactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-border hover:bg-muted/30">
                          <td className="p-3 text-sm">{formatDate(tx.date)}</td>
                          <td className="p-3 text-sm"><span className={tx.type === 'income' ? 'text-success' : 'text-destructive'}>{tx.type === 'income' ? 'Gelir' : 'Gider'}</span></td>
                          <td className="p-3 text-sm">{tx.category}</td>
                          <td className="p-3 text-sm text-muted-foreground">{tx.description || '-'}</td>
                          {reportType === 'sold' && <td className="p-3 text-sm">{carSoldByMap[tx.car_id] || '-'}</td>}
                          <td className={`p-3 text-sm text-right font-medium ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end mb-6 sm:mb-8">
            <div className="w-full sm:w-80">
              {reportType === 'general' && (
                <>
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase mb-1">Araç İşlemleri</p>
                  <div className="flex justify-between py-1 sm:py-1.5 text-xs sm:text-sm"><span className="text-muted-foreground">Gelir:</span><span className="text-success font-medium">{formatCurrency(vehicleTotals.income)}</span></div>
                  <div className="flex justify-between py-1 sm:py-1.5 text-xs sm:text-sm border-b border-border"><span className="text-muted-foreground">Gider:</span><span className="text-destructive font-medium">-{formatCurrency(vehicleTotals.expense)}</span></div>
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase mb-1 mt-2 sm:mt-3">İşletme İşlemleri</p>
                  <div className="flex justify-between py-1 sm:py-1.5 text-xs sm:text-sm"><span className="text-muted-foreground">Gelir:</span><span className="text-success font-medium">{formatCurrency(businessTotals.income)}</span></div>
                  <div className="flex justify-between py-1 sm:py-1.5 text-xs sm:text-sm border-b border-border"><span className="text-muted-foreground">Gider:</span><span className="text-destructive font-medium">-{formatCurrency(businessTotals.expense)}</span></div>
                </>
              )}
              {reportType !== 'general' && (
                <>
                  <div className="flex justify-between py-1.5 sm:py-2 border-b border-border text-xs sm:text-sm"><span className="text-muted-foreground">Toplam Gelir:</span><span className="text-success font-medium">{formatCurrency(totals.income)}</span></div>
                  <div className="flex justify-between py-1.5 sm:py-2 border-b border-border text-xs sm:text-sm"><span className="text-muted-foreground">Toplam Gider:</span><span className="text-destructive font-medium">-{formatCurrency(totals.expense)}</span></div>
                </>
              )}
              <div className="flex justify-between py-2 sm:py-3 font-bold text-sm sm:text-base"><span>NET SONUÇ:</span><span>{formatCurrency(totals.net)} (%{profitMargin})</span></div>
            </div>
          </div>

          <div className="flex justify-between pt-4 sm:pt-8 border-t border-border mt-4 sm:mt-8 gap-4">
            <div className="text-center flex-1">
              <p className="font-medium text-xs sm:text-base mb-4 sm:mb-8">Muhasebe / Onay</p>
              <div className="w-full max-w-[180px] mx-auto border-t border-foreground pt-2"><p className="text-[10px] sm:text-sm text-muted-foreground">İmza / Kaşe</p></div>
            </div>
            <div className="text-center flex-1">
              <p className="font-medium text-xs sm:text-base mb-4 sm:mb-8 truncate">{companyName} Yetkilisi</p>
              <div className="w-full max-w-[180px] mx-auto border-t border-foreground pt-2"><p className="text-[10px] sm:text-sm text-muted-foreground">İmza</p></div>
            </div>
          </div>
          </>
          )}
        </div>
      </DialogContent>

      {/* ✅ Rapor ekranından doğrudan masraf ekleme/düzenleme — VehicleExpensesModal */}
      {expensesFor && (
        <VehicleExpensesModal
          isOpen={!!expensesFor}
          onClose={() => setExpensesFor(null)}
          car={expensesFor}
        />
      )}
    </Dialog>
  );
};

export default ReportModal;
