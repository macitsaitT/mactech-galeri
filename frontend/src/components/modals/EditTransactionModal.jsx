import React, { useState, useEffect } from 'react';
import { Edit } from 'lucide-react';
import { formatNumberInput, parseNumber } from '../../utils/helpers';
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
  'Detaylı Yıkama', 'Ekspertiz', 'Taşıma/Çekici',
  'Personel Maaşı', 'Kira', 'Ofis Gideri', 'Elektrik/Su/Doğalgaz',
  'İnternet/Telefon', 'Vergi', 'Reklam/Pazarlama', 'Bakım/Onarım',
  'Temizlik', 'Kırtasiye', 'Yemek/İkram', 'Ulaşım',
  'Komisyon', 'Araç Satışı', 'Kapora', 'Çalışan Payı',
  'Diğer Gelir', 'Diğer Gider', 'Diğer'
];

const EditTransactionModal = ({ isOpen, onClose, transaction }) => {
  const { updateTransaction } = useApp();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'expense',
    category: '',
    amount: '',
    description: '',
    date: ''
  });

  useEffect(() => {
    if (transaction && isOpen) {
      setFormData({
        type: transaction.type || 'expense',
        category: transaction.category || '',
        amount: formatNumberInput(transaction.amount),
        description: transaction.description || '',
        date: transaction.date || new Date().toISOString().split('T')[0]
      });
    }
  }, [transaction, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || parseNumber(formData.amount) <= 0 || !transaction) return;

    setLoading(true);
    try {
      await updateTransaction(transaction.id, {
        type: formData.type,
        category: formData.category,
        amount: parseNumber(formData.amount),
        description: formData.description,
        date: formData.date
      });
      onClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="edit-tx-modal-title">
            <Edit size={24} className="text-primary" />
            İşlem Düzenle
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Type */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'income' })}
              className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                formData.type === 'income'
                  ? 'bg-success text-success-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
              data-testid="edit-type-income"
            >
              Gelir
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'expense' })}
              className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                formData.type === 'expense'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
              data-testid="edit-type-expense"
            >
              Gider
            </button>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Kategori</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary"
              data-testid="edit-tx-category"
            >
              {expenseCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              {!expenseCategories.includes(formData.category) && formData.category && (
                <option value={formData.category}>{formData.category}</option>
              )}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-2">Tutar (₺)</label>
            <input
              type="text"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: formatNumberInput(e.target.value) })}
              className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary"
              placeholder="0"
              data-testid="edit-tx-amount"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-2">Tarih</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary"
              data-testid="edit-tx-date"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full h-20 p-3 bg-background border border-border rounded-lg outline-none focus:border-primary resize-none"
              placeholder="Açıklama..."
              data-testid="edit-tx-description"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading || !formData.amount}
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
              data-testid="save-edit-tx-btn"
            >
              {loading ? 'Kaydediliyor...' : 'Güncelle'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditTransactionModal;
