import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatPhoneInput } from '../../utils/helpers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const defaultFormData = {
  name: '',
  phone: '',
  type: 'Potansiyel',
  notes: '',
  interested_car_id: ''
};

const customerTypes = ['Potansiyel', 'Aktif', 'Satış Yapıldı', 'Satıcı'];

const AddCustomerModal = ({ isOpen, onClose, onSave, editingCustomer = null }) => {
  const { cars } = useApp();
  const [formData, setFormData] = useState(defaultFormData);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const activeCars = cars.filter(c => !c.deleted && c.status !== 'Satıldı');

  useEffect(() => {
    if (editingCustomer) {
      setFormData({
        name: editingCustomer.name || '',
        phone: editingCustomer.phone || '',
        type: editingCustomer.type || 'Potansiyel',
        notes: editingCustomer.notes || '',
        interested_car_id: editingCustomer.interested_car_id || ''
      });
    } else {
      setFormData(defaultFormData);
    }
    setErrors({});
  }, [editingCustomer, isOpen]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name?.trim()) newErrors.name = 'İsim giriniz';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={24} className="text-primary" />
            {editingCustomer ? 'Müşteri Düzenle' : 'Yeni Müşteri'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-2">İsim Soyisim *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full h-12 px-4 bg-background border rounded-lg outline-none transition-colors ${errors.name ? 'border-destructive' : 'border-border focus:border-primary'}`}
              placeholder="Müşteri adı"
              data-testid="customer-name-input"
            />
            {errors.name && <p className="text-destructive text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Telefon</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', formatPhoneInput(e.target.value))}
              className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
              placeholder="0532 XXX XX XX"
              maxLength={14}
              data-testid="customer-phone-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Müşteri Durumu</label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
              data-testid="customer-type-select"
            >
              {customerTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">İlgilendiği Araç</label>
            <select
              value={formData.interested_car_id}
              onChange={(e) => handleChange('interested_car_id', e.target.value)}
              className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
              data-testid="customer-car-select"
            >
              <option value="">Seçilmedi</option>
              {activeCars.map(car => (
                <option key={car.id} value={car.id}>
                  {car.brand} {car.model} - {car.plate?.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notlar</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full h-24 p-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors resize-none"
              placeholder="Müşteri hakkında notlar..."
              data-testid="customer-notes-input"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
              data-testid="cancel-customer-btn"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-lg gradient-gold text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
              data-testid="save-customer-btn"
            >
              {loading ? 'Kaydediliyor...' : (editingCustomer ? 'Güncelle' : 'Kaydet')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerModal;
