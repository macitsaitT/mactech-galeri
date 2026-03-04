import React, { useState, useMemo } from 'react';
import { Receipt, TrendingDown, Plus, Edit } from 'lucide-react';
import { formatCurrency, formatDate, formatNumberInput, parseNumber } from '../../utils/helpers';
import { useApp } from '../../context/AppContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const expenseCategories = [
  'Genel Gider', 'Boya', 'Mekanik Bakım', 'Yedek Parça',
  'Lastik', 'Sigorta', 'Muayene', 'Kaporta', 'Elektrik',
  'Detaylı Yıkama', 'Ekspertiz', 'Taşıma/Çekici', 'Diğer'
];

const VehicleExpensesModal = ({ isOpen, onClose, car }) => {
  const { transactions, addTransaction, updateTransaction } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Genel Gider',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const carExpenses = useMemo(() => {
    if (!car) return [];
    return transactions
      .filter(t => t.car_id === car.id && !t.deleted)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, car]);

  const totalExpense = useMemo(() =>
    carExpenses.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0),
    [carExpenses]
  );

  const totalIncome = useMemo(() =>
    carExpenses.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0),
    [carExpenses]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || parseNumber(formData.amount) <= 0 || !car) return;

    setLoading(true);
    try {
      if (editingTx) {
        await updateTransaction(editingTx.id, {
          category: formData.category,
          amount: parseNumber(formData.amount),
          description: formData.description,
          date: formData.date
        });
        setEditingTx(null);
      } else {
        await addTransaction({
          type: 'expense',
          category: formData.category,
          amount: parseNumber(formData.amount),
          description: `${formData.description} - ${car.plate?.toUpperCase()}`,
          date: formData.date,
          car_id: car.id
        });
      }
      setFormData({ category: 'Genel Gider', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (tx) => {
    setEditingTx(tx);
    setFormData({
      category: tx.category || 'Genel Gider',
      amount: formatNumberInput(tx.amount),
      description: tx.description || '',
      date: tx.date || new Date().toISOString().split('T')[0],
    });
    setShowAddForm(true);
  };

  if (!car) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="vehicle-expenses-title">
            <Receipt size={24} className="text-warning" />
            Masraflar - {car.plate?.toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Toplam Gider</p>
              <p className="font-bold text-lg text-destructive tabular-nums" data-testid="total-expense">
                {formatCurrency(totalExpense)}
              </p>
            </div>
            <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Toplam Gelir</p>
              <p className="font-bold text-lg text-success tabular-nums" data-testid="total-income">
                {formatCurrency(totalIncome)}
              </p>
            </div>
          </div>

          {/* Add Expense Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              data-testid="add-car-expense-btn"
            >
              <Plus size={18} />
              Masraf Ekle
            </button>
          )}

          {/* Add Form */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
              <p className="text-sm font-medium">{editingTx ? 'İşlem Düzenle' : 'Yeni Masraf Ekle'}</p>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                data-testid="car-expense-category"
              >
                {expenseCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <input
                type="text"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: formatNumberInput(e.target.value) })}
                className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                placeholder="Tutar (₺)"
                data-testid="car-expense-amount"
              />
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                data-testid="car-expense-date"
              />
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                placeholder="Açıklama (opsiyonel)"
                data-testid="car-expense-description"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !formData.amount}
                  className="flex-1 py-2 bg-warning text-warning-foreground rounded-lg text-sm font-medium disabled:opacity-50"
                  data-testid="save-car-expense-btn"
                >
                  {loading ? 'Kaydediliyor...' : editingTx ? 'Güncelle' : 'Ekle'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingTx(null); }}
                  className="flex-1 py-2 border border-border rounded-lg text-sm"
                >
                  İptal
                </button>
              </div>
            </form>
          )}

          {/* Transaction List */}
          {carExpenses.length === 0 ? (
            <div className="py-8 text-center">
              <Receipt size={40} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">Bu araca ait işlem bulunamadı</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {carExpenses.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                  data-testid={`car-expense-${tx.id}`}
                >
                  <div className={`p-1.5 rounded-lg ${tx.type === 'income' ? 'bg-success/20' : 'bg-destructive/20'}`}>
                    <TrendingDown size={16} className={tx.type === 'income' ? 'text-success rotate-180' : 'text-destructive'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{tx.category}</p>
                    <p className="text-xs text-muted-foreground truncate">{tx.description || '-'}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <button
                      onClick={() => startEdit(tx)}
                      className="p-1 text-muted-foreground hover:text-primary transition-colors"
                      data-testid={`edit-car-expense-${tx.id}`}
                    >
                      <Edit size={14} />
                    </button>
                    <div>
                      <p className={`font-bold text-sm tabular-nums ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleExpensesModal;
