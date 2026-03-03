import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/helpers';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Search,
  Trash2,
  RotateCcw,
  Calendar,
  Filter,
  Download,
  Users
} from 'lucide-react';
import { exportAPI, usersAPI } from '../services/api';

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
};

const FinancePage = () => {
  const { transactions, cars, deleteTransaction, patchCar, user } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [orgUsers, setOrgUsers] = useState([]);
  const [exporting, setExporting] = useState(false);

  const userRole = user?.role || 'admin';

  // Fetch org users for person filter (muhasebe & admin)
  useEffect(() => {
    if (userRole === 'muhasebe' || userRole === 'admin') {
      usersAPI.getEmployees().then(res => setOrgUsers(res.data || [])).catch(() => {});
    }
  }, [userRole]);

  const filteredTransactions = useMemo(() => {
    let result = transactions.filter(t => !t.deleted);

    // Person filter
    if (filterUser !== 'all') {
      result = result.filter(t => t.created_by === filterUser);
    }

    // Type filter
    if (filterType === 'income') {
      result = result.filter(t => t.type === 'income');
    } else if (filterType === 'expense') {
      result = result.filter(t => t.type === 'expense');
    }

    // Date filter
    const now = new Date();
    if (dateRange === 'today') {
      const today = now.toISOString().split('T')[0];
      result = result.filter(t => t.date === today);
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(t => new Date(t.date) >= weekAgo);
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter(t => new Date(t.date) >= monthAgo);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.category?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.date) - new Date(a.date));

    return result;
  }, [transactions, searchQuery, filterType, dateRange, filterUser]);

  // Calculate totals
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const expense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  // Get car info for transaction
  const getCarInfo = (carId) => {
    if (!carId) return null;
    return cars.find(c => c.id === carId);
  };

  const handleDelete = async (transaction) => {
    if (window.confirm('Bu işlemi kalıcı olarak silmek istediğinize emin misiniz? İlgili araç durumu geri alınacaktır.')) {
      // Revert car status before deleting
      await revertTransactionEffect(transaction);
      await deleteTransaction(transaction.id, true);
    }
  };

  const handleCancel = async (transaction) => {
    if (window.confirm('Bu işlemi iptal etmek istediğinize emin misiniz? İlgili araç durumu eski haline döndürülecektir.')) {
      await revertTransactionEffect(transaction);
      await deleteTransaction(transaction.id, false);
    }
  };

  const revertTransactionEffect = async (tx) => {
    if (!tx.car_id) return;
    const car = cars.find(c => c.id === tx.car_id);
    if (!car) return;

    // Revert sale: car was sold, bring back to stock or deposit status
    if (tx.category === 'Araç Satışı' && car.status === 'Satıldı') {
      const newStatus = (car.deposit_amount && car.deposit_amount > 0) ? 'Kapora Alındı' : 'Stokta';
      await patchCar(tx.car_id, { status: newStatus, sold_date: '', sale_price: car.sale_price || 0 });
    }

    // Revert deposit: remove deposit from car
    if (tx.category === 'Kapora' && car.status === 'Kapora Alındı') {
      await patchCar(tx.car_id, { status: 'Stokta', deposit_amount: 0 });
    }

    // Revert deposit addition: reduce deposit
    if (tx.category === 'Kapora Eklemesi' && car.deposit_amount > 0) {
      const newDeposit = Math.max(0, (car.deposit_amount || 0) - tx.amount);
      const newStatus = newDeposit > 0 ? 'Kapora Alındı' : 'Stokta';
      await patchCar(tx.car_id, { status: newStatus, deposit_amount: newDeposit });
    }

    // Revert deposit refund: restore deposit
    if (tx.category === 'Kapora İadesi') {
      await patchCar(tx.car_id, { status: 'Kapora Alındı', deposit_amount: tx.amount });
    }

    // Revert employee share: just delete the transaction, no car change needed
    // Revert owner payment: just delete the transaction, no car change needed
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-success/20 to-success/5 border border-success/20 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-success/20">
              <TrendingUp size={20} className="text-success" />
            </div>
            <span className="text-muted-foreground text-sm">Gelir</span>
          </div>
          <p className="font-heading font-bold text-2xl text-success tabular-nums">
            {formatCurrency(totals.income)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-destructive/20 to-destructive/5 border border-destructive/20 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-destructive/20">
              <TrendingDown size={20} className="text-destructive" />
            </div>
            <span className="text-muted-foreground text-sm">Gider</span>
          </div>
          <p className="font-heading font-bold text-2xl text-destructive tabular-nums">
            {formatCurrency(totals.expense)}
          </p>
        </div>

        <div className={`bg-gradient-to-br ${totals.net >= 0 ? 'from-primary/20 to-primary/5 border-primary/20' : 'from-destructive/20 to-destructive/5 border-destructive/20'} border rounded-xl p-5`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${totals.net >= 0 ? 'bg-primary/20' : 'bg-destructive/20'}`}>
              <Wallet size={20} className={totals.net >= 0 ? 'text-primary' : 'text-destructive'} />
            </div>
            <span className="text-muted-foreground text-sm">Net</span>
          </div>
          <p className={`font-heading font-bold text-2xl tabular-nums ${totals.net >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {formatCurrency(totals.net)}
          </p>
        </div>
      </div>

      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kategori veya açıklama ara..."
            className="w-full h-12 pl-12 pr-4 bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            data-testid="finance-search"
          />
        </div>

        {/* Type Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-12 px-4 bg-card border border-border rounded-lg focus:border-primary outline-none text-sm"
          data-testid="type-filter"
        >
          <option value="all">Tüm İşlemler</option>
          <option value="income">Gelirler</option>
          <option value="expense">Giderler</option>
        </select>

        {/* Date Filter */}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="h-12 px-4 bg-card border border-border rounded-lg focus:border-primary outline-none text-sm"
          data-testid="date-filter"
        >
          <option value="all">Tüm Zamanlar</option>
          <option value="today">Bugün</option>
          <option value="week">Son 7 Gün</option>
          <option value="month">Son 30 Gün</option>
        </select>

        {/* Person Filter (Muhasebe & Admin) */}
        {(userRole === 'muhasebe' || userRole === 'admin') && orgUsers.length > 1 && (
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="h-12 px-4 bg-card border border-border rounded-lg focus:border-primary outline-none text-sm"
            data-testid="person-filter"
          >
            <option value="all">Tüm Kişiler</option>
            {orgUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === 'admin' ? 'Admin' : u.role === 'muhasebe' ? 'Muhasebe' : 'Satış'})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Transactions List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-heading font-semibold">İşlem Geçmişi</h3>
            <p className="text-sm text-muted-foreground">{filteredTransactions.length} işlem</p>
          </div>
          <button
            onClick={async () => {
              setExporting(true);
              try {
                const res = await exportAPI.transactions();
                downloadBlob(new Blob([res.data]), 'islemler.docx');
              } catch (e) {
                console.error(e);
                alert('Word indirme hatası: ' + (e.message || 'Bilinmeyen hata'));
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-background border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            data-testid="export-transactions-btn"
          >
            <Download size={16} className={exporting ? 'animate-bounce' : ''} />
            {exporting ? 'İndiriliyor...' : 'Word'}
          </button>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <Wallet size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">İşlem bulunamadı</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTransactions.map((tx) => {
              const car = getCarInfo(tx.car_id);
              const isIncome = tx.type === 'income';

              return (
                <div 
                  key={tx.id} 
                  className="p-4 hover:bg-muted/50 transition-colors flex items-center gap-4"
                  data-testid={`transaction-${tx.id}`}
                >
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${isIncome ? 'bg-success/20' : 'bg-destructive/20'}`}>
                    {isIncome ? (
                      <TrendingUp size={20} className="text-success" />
                    ) : (
                      <TrendingDown size={20} className="text-destructive" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{tx.category}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {tx.description || '-'}
                      {car && ` • ${car.plate?.toUpperCase()}`}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="hidden sm:block text-right">
                    <p className="text-sm text-muted-foreground">{formatDate(tx.date)}</p>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p className={`font-heading font-bold tabular-nums ${isIncome ? 'text-success' : 'text-destructive'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCancel(tx)}
                      title="İptal Et (Geri Al)"
                      className="p-1.5 text-muted-foreground hover:text-amber-500 transition-colors"
                      data-testid={`cancel-tx-${tx.id}`}
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(tx)}
                      title="Kalıcı Sil"
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      data-testid={`delete-tx-${tx.id}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancePage;
