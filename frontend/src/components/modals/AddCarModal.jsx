import React, { useState, useEffect } from 'react';
import { X, Car, FileText, Camera, Users, CheckCircle, Upload, Trash2, Loader2, FolderOpen, ShoppingCart, X as XIcon, Wallet } from 'lucide-react';
import { formatNumberInput, parseNumber, formatPhoneInput } from '../../utils/helpers';
import { carBrands, carModels, engineTypes, gearTypes, fuelTypes, vehicleTypes, modelYears, getEnginesForModel, getPackagesForModel, getGearsForSelection } from '../../data/carData';
import { provinceList, getDistrictsByProvince } from '../../data/turkeyData';
import CarExpertiseDiagram from '../CarExpertiseDiagram';
import { fileAPI, notificationsAPI, transactionsAPI } from '../../services/api';
import VehicleExpensesModal from './VehicleExpensesModal';
import { toast } from 'sonner';

const INLINE_EXPENSE_CATEGORIES = [
  'Genel Gider', 'Boya', 'Mekanik Bakım', 'Yedek Parça',
  'Lastik', 'Sigorta', 'Muayene', 'Kaporta', 'Elektrik',
  'Detaylı Yıkama', 'Ekspertiz', 'Taşıma/Çekici', 'Diğer'
];

// Document Category Component
const DocumentCategory = ({ doc, docs, formData, handleChange }) => {
  const [uploading, setUploading] = useState(false);

  const handleDocUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newDocs = [...docs];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // 50MB limit
        if (file.size > 50 * 1024 * 1024) {
          alert(`${file.name} çok büyük (max 50MB)`);
          continue;
        }
        
        try {
          const res = await fileAPI.smartUpload(file);
          newDocs.push({
            path: res.data.path,
            name: file.name,
            uploadedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error('Upload failed:', err);
          alert(`"${file.name}" yüklenemedi.`);
        }
      }
      handleChange('documents', {
        ...formData.documents,
        [doc.id]: newDocs
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDocDelete = (index) => {
    const newDocs = docs.filter((_, i) => i !== index);
    handleChange('documents', {
      ...formData.documents,
      [doc.id]: newDocs
    });
  };

  return (
    <div className="p-4 bg-muted/30 border border-border rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{doc.icon}</span>
          <h5 className="font-semibold text-sm">{doc.label}</h5>
          {docs.length > 0 && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              {docs.length} dosya
            </span>
          )}
        </div>
        <label className="cursor-pointer px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
          <Upload size={14} />
          {uploading ? 'Yükleniyor...' : 'Yükle'}
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => handleDocUpload(e.target.files)}
            disabled={uploading}
          />
        </label>
      </div>
      
      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((docFile, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-background/50 rounded-lg border border-border/50 group hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText size={16} className="text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{docFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(docFile.uploadedAt).toLocaleDateString('tr-TR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={docFile.path.startsWith('http') ? docFile.path : fileAPI.getUrl(docFile.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
                  title="Görüntüle"
                >
                  <Camera size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => handleDocDelete(index)}
                  className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
                  title="Sil"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {docs.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Henüz belge yüklenmedi
        </p>
      )}
    </div>
  );
};

const PhotoUploadTab = ({ formData, handleChange }) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const newPhotos = [...(formData.photos || [])];
      const totalFiles = files.length;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Limit: 50MB
        if (file.size > 50 * 1024 * 1024) {
          alert('Dosya çok büyük (max 50MB)');
          continue;
        }
        
        try {
          // Smart upload kullan - otomatik olarak en uygun yöntemi seçer
          const res = await fileAPI.smartUpload(file, (progress) => {
            // Her dosya için progress
            const overallProgress = Math.round(((i + progress / 100) / totalFiles) * 100);
            setUploadProgress(overallProgress);
          });
          newPhotos.push(res.data.path);
          setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
        } catch (uploadError) {
          console.error('Smart upload failed, trying fallback:', uploadError);
          // Fallback: Normal upload dene
          try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fileAPI.upload(fd);
            newPhotos.push(res.data.path);
          } catch (fallbackError) {
            console.error('All upload methods failed:', fallbackError);
            alert(`"${file.name}" yüklenemedi. Lütfen daha küçük bir dosya deneyin.`);
          }
        }
      }
      handleChange('photos', newPhotos);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Fotoğraf yüklenemedi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4 py-4">
      <div
        className={`text-center py-12 border-2 border-dashed rounded-xl transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={48} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Yükleniyor... %{uploadProgress}</p>
            <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">Fotoğraf yüklemek için tıklayın veya sürükleyin</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP, HEIC (max. 50MB)</p>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              id="photo-upload"
              data-testid="photo-upload-input"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <label
              htmlFor="photo-upload"
              className="inline-flex items-center gap-2 mt-4 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg cursor-pointer hover:bg-primary/90 transition-colors font-medium text-sm"
              data-testid="photo-upload-btn"
            >
              <Upload size={16} />
              Fotoğraf Seç
            </label>
          </>
        )}
      </div>

      {formData.photos && formData.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {formData.photos.map((photo, index) => (
            <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-muted group" data-testid={`photo-preview-${index}`}>
              <img
                src={photo.startsWith('http') ? photo : fileAPI.getUrl(photo)}
                alt={`Araç ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = ''; e.target.className = 'hidden'; }}
              />
              <button
                type="button"
                onClick={() => {
                  const newPhotos = formData.photos.filter((_, i) => i !== index);
                  handleChange('photos', newPhotos);
                }}
                className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`remove-photo-${index}`}
              >
                <Trash2 size={14} />
              </button>
              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                {index + 1}/{formData.photos.length}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

// Expertise sections
const expertiseParts = [
  { id: 'kaput', name: 'Kaput', position: 'top-center' },
  { id: 'tavan', name: 'Tavan', position: 'top-center-2' },
  { id: 'bagaj', name: 'Bagaj', position: 'bottom-center' },
  { id: 'on_tampon', name: 'Ön Tampon', position: 'front' },
  { id: 'arka_tampon', name: 'Arka Tampon', position: 'back' },
  { id: 'sol_on_camurluk', name: 'Sol Ön Çamurluk', position: 'left-front' },
  { id: 'sol_on_kapi', name: 'Sol Ön Kapı', position: 'left-front-door' },
  { id: 'sol_arka_kapi', name: 'Sol Arka Kapı', position: 'left-back-door' },
  { id: 'sol_arka_camurluk', name: 'Sol Arka Çamurluk', position: 'left-back' },
  { id: 'sag_on_camurluk', name: 'Sağ Ön Çamurluk', position: 'right-front' },
  { id: 'sag_on_kapi', name: 'Sağ Ön Kapı', position: 'right-front-door' },
  { id: 'sag_arka_kapi', name: 'Sağ Arka Kapı', position: 'right-back-door' },
  { id: 'sag_arka_camurluk', name: 'Sağ Arka Çamurluk', position: 'right-back' },
];

const expertiseStatuses = [
  { value: 'orijinal', label: 'Orijinal', color: 'bg-success/20 text-success border-success/30' },
  { value: 'boyali', label: 'Boyalı', color: 'bg-warning/20 text-warning border-warning/30' },
  { value: 'lokal', label: 'Lokal Boyalı', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'degisen', label: 'Değişen', color: 'bg-destructive/20 text-destructive border-destructive/30' },
];

const mechanicalParts = [
  { id: 'motor', name: 'Motor Durumu' },
  { id: 'sanziman', name: 'Şanzıman Durumu' },
  { id: 'yuruyen', name: 'Yürüyen Durumu' },
];

const mechanicalStatuses = ['Orijinal', 'Bakımlı', 'Değişmiş', 'Sorunlu'];

const defaultFormData = {
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  plate: '',
  km: '',
  vehicle_type: 'Sedan',
  purchase_price: '',
  sale_price: '',
  description: '',
  status: 'Stokta',
  entry_date: new Date().toISOString().split('T')[0],
  inspection_date: '',
  inspection_notification_days: 30,
  fuel_type: 'Dizel',
  gear: 'Otomatik',
  ownership: 'stock',
  owner_name: '',
  owner_phone: '',
  commission_rate: '',
  photos: [],
  expertise: {
    parts: {},
    mechanical: {
      motor: 'Orijinal',
      sanziman: 'Orijinal',
      yuruyen: 'Orijinal'
    }
  },
  package_info: '',
  engine_type: '',
  insurance_start: '',
  insurance_end: '',
  province: '',
  district: '',
  expertise_score: 95,
  tramer_amount: '',
  expertise_notes: '',
  // Fatura bilgileri
  is_invoiced: false,
  invoice_number: '',
  invoice_date: '',
  invoice_seller_name: '',
  invoice_seller_tax_id: '',
  invoice_seller_address: '',
  // Araç Belgeleri
  documents: {
    ruhsat: [],
    muayene: [],
    sigorta: [],
    ekspertiz: [],
    vekaletname: [],
    diger: []
  },
  // Satış Bilgileri (Düzenleme için)
  employee_share: '',
  sold_by: '',
  muayene_tarihi: '',
  sigorta_bitis_tarihi: '',
  // Hatırlatmalar
  muayene_reminders: [],
  sigorta_reminders: [],
  // ✅ Inline (yeni araç eklerken anında girilen) masraflar — kaydedilen aracın id'si ile transaction olarak yazılacak
  pending_expenses: []
};

const AddCarModal = ({ isOpen, onClose, onSave, editingCar = null }) => {
  const [formData, setFormData] = useState(defaultFormData);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('general');
  // ✅ Masraf modal state — kaydedilen / düzenlenen aracın id'siyle açılır
  const [expensesModal, setExpensesModal] = useState({ open: false, carId: null, plate: '' });

  useEffect(() => {
    if (editingCar) {
      setFormData({
        ...defaultFormData,
        ...editingCar,
        km: formatNumberInput(editingCar.km),
        purchase_price: formatNumberInput(editingCar.purchase_price),
        sale_price: formatNumberInput(editingCar.sale_price),
        employee_share: formatNumberInput(editingCar.employee_share || 0),
        expertise: editingCar.expertise || defaultFormData.expertise,
      });
      
      // Mevcut hatırlatmaları yükle
      if (editingCar.id) {
        notificationsAPI.getCarReminders(editingCar.id).then(res => {
          const reminders = res.data.reminders || [];
          const muayeneReminders = reminders
            .filter(r => r.reminder_type === 'muayene')
            .map(r => ({ id: r.id, date: r.remind_date, time: r.remind_time }));
          const sigortaReminders = reminders
            .filter(r => r.reminder_type === 'sigorta')
            .map(r => ({ id: r.id, date: r.remind_date, time: r.remind_time }));
          
          setFormData(prev => ({
            ...prev,
            muayene_reminders: muayeneReminders,
            sigorta_reminders: sigortaReminders
          }));
        }).catch(err => console.error('Hatırlatmalar yüklenemedi:', err));
      }
    } else {
      setFormData(defaultFormData);
    }
    setErrors({});
    setActiveTab('general');
  }, [editingCar, isOpen]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleNumberChange = (field, value) => {
    const formatted = formatNumberInput(value);
    setFormData(prev => ({ ...prev, [field]: formatted }));
  };

  const handleExpertiseChange = (partId, value) => {
    setFormData(prev => ({
      ...prev,
      expertise: {
        ...prev.expertise,
        parts: {
          ...prev.expertise.parts,
          [partId]: value
        }
      }
    }));
  };

  const handleMechanicalChange = (partId, value) => {
    setFormData(prev => ({
      ...prev,
      expertise: {
        ...prev.expertise,
        mechanical: {
          ...prev.expertise.mechanical,
          [partId]: value
        }
      }
    }));
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.brand) newErrors.brand = 'Marka seçiniz';
    if (!formData.model) newErrors.model = 'Model giriniz';
    if (!formData.plate) newErrors.plate = 'Plaka giriniz';
    if (!formData.sale_price || parseNumber(formData.sale_price) <= 0) {
      newErrors.sale_price = 'Satış fiyatı giriniz';
    }
    if (formData.ownership === 'stock' && (!formData.purchase_price || parseNumber(formData.purchase_price) <= 0)) {
      newErrors.purchase_price = 'Stok araç için alış fiyatı gerekli';
    }
    
    // Fatura validasyonu
    if (formData.is_invoiced) {
      if (!formData.invoice_number) newErrors.invoice_number = 'Fatura numarası gerekli';
      if (!formData.invoice_date) newErrors.invoice_date = 'Fatura tarihi gerekli';
      if (!formData.invoice_seller_name) newErrors.invoice_seller_name = 'Satıcı adı gerekli';
      if (!formData.invoice_seller_tax_id) newErrors.invoice_seller_tax_id = 'TC/Vergi no gerekli';
      if (!formData.invoice_seller_address) newErrors.invoice_seller_address = 'Satıcı adresi gerekli';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      setActiveTab('general');
      return;
    }

    setLoading(true);
    try {
      // pending_expenses'ı submit payload'undan ayır — backend araç modeli bilmiyor
      const pendingExpenses = (formData.pending_expenses || []).filter(
        (e) => e && parseNumber(e.amount) > 0
      );
      const submitData = {
        ...formData,
        km: formData.km?.replace(/[^\d]/g, '') || '0',
        purchase_price: parseNumber(formData.purchase_price),
        sale_price: parseNumber(formData.sale_price),
        employee_share: parseNumber(formData.employee_share),
        tramer_amount: parseNumber(formData.tramer_amount),
        commission_rate: parseInt(formData.commission_rate) || (formData.ownership === 'consignment' ? 5 : 0),
        year: parseInt(formData.year) || new Date().getFullYear(),
        expertise_score: parseInt(formData.expertise_score) || 0,
      };
      delete submitData.pending_expenses;

      const savedCar = await onSave(submitData);

      // Hatırlatmaları backend'e kaydet
      const carId = savedCar?.id || editingCar?.id;
      if (carId) {
        // ✅ Inline masrafları transaction olarak kaydet (Gider) — kasa otomatik düşer
        if (pendingExpenses.length > 0) {
          let okCount = 0;
          for (const exp of pendingExpenses) {
            try {
              await transactionsAPI.create({
                type: 'expense',
                category: exp.category || 'Genel Gider',
                amount: parseNumber(exp.amount),
                description: `${exp.description || ''}${exp.description ? ' - ' : ''}${(savedCar?.plate || formData.plate || '').toUpperCase()}`,
                date: exp.date || new Date().toISOString().split('T')[0],
                car_id: carId,
              });
              okCount++;
            } catch (err) {
              console.error('Inline masraf kaydı başarısız:', err);
            }
          }
          if (okCount > 0) {
            toast.success(`${okCount} masraf kaydedildi`);
          }
          if (okCount < pendingExpenses.length) {
            toast.error(`${pendingExpenses.length - okCount} masraf kaydedilemedi`);
          }
        }
        // Muayene hatırlatmalarını kaydet
        if (formData.muayene_reminders && formData.muayene_reminders.length > 0) {
          for (const reminder of formData.muayene_reminders) {
            if (reminder.date && reminder.time) {
              try {
                await notificationsAPI.createReminder({
                  car_id: carId,
                  reminder_type: 'muayene',
                  remind_date: reminder.date,
                  remind_time: reminder.time
                });
              } catch (err) {
                console.error('Hatırlatma kaydedilemedi:', err);
              }
            }
          }
        }
        
        // Sigorta hatırlatmalarını kaydet
        if (formData.sigorta_reminders && formData.sigorta_reminders.length > 0) {
          for (const reminder of formData.sigorta_reminders) {
            if (reminder.date && reminder.time) {
              try {
                await notificationsAPI.createReminder({
                  car_id: carId,
                  reminder_type: 'sigorta',
                  remind_date: reminder.date,
                  remind_time: reminder.time
                });
              } catch (err) {
                console.error('Hatırlatma kaydedilemedi:', err);
              }
            }
          }
        }
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving car:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableModels = carModels[formData.brand] || [];
  const modelEngines = getEnginesForModel(formData.brand, formData.model);
  const availableEngines = modelEngines || engineTypes;
  const availablePackages = getPackagesForModel(formData.brand, formData.model);
  // ✅ Vites listesi motor + markaya göre dinamik filtrelenir (elektrik motor → tek vites, marka-spesifik vitesleri gizle)
  const availableGears = getGearsForSelection(formData.brand, formData.engine_type);
  const availableDistricts = getDistrictsByProvince(formData.province);

  const tabs = [
    { id: 'general', label: 'Genel Bilgiler', icon: FileText },
    { id: 'expertise', label: 'Ekspertiz', icon: CheckCircle },
    { id: 'photos', label: 'Fotoğraflar', icon: Camera },
    { id: 'documents', label: 'Belgeler', icon: FolderOpen },
    { id: 'ownership', label: 'Sahiplik / Konsinye', icon: Users },
    ...(editingCar ? [{ id: 'sale_info', label: editingCar.status === 'Satıldı' ? 'Satış Bilgileri' : 'Çalışan Payı', icon: ShoppingCart }] : []),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Car size={24} className="text-primary" />
            {editingCar ? 'Araç Düzenle' : 'Yeni Araç Girişi'}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs - highly visible on mobile */}
        <div className="grid grid-cols-5 gap-1 px-4 sm:px-6 mt-3 mb-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <Icon size={14} className="flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-[11px] leading-tight">{
                  tab.id === 'general' ? 'Genel' :
                  tab.id === 'expertise' ? 'Eksper' :
                  tab.id === 'photos' ? 'Foto' :
                  tab.id === 'documents' ? 'Belge' :
                  'Sahip'
                }</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6 pb-4 sm:pb-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-4 py-4">
              {/* Basic Info Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Plaka</label>
                  <input
                    type="text"
                    value={formData.plate}
                    onChange={(e) => handleChange('plate', e.target.value.toUpperCase())}
                    className={`w-full h-11 px-3 bg-background border rounded-lg outline-none transition-colors uppercase text-sm ${errors.plate ? 'border-destructive' : 'border-border focus:border-primary'}`}
                    placeholder="34 AB 123"
                    data-testid="car-plate-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Model Yılı</label>
                  <select
                    value={formData.year}
                    onChange={(e) => handleChange('year', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    data-testid="car-year-select"
                  >
                    {modelYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Marka</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => {
                      handleChange('brand', e.target.value);
                      handleChange('model', '');
                      handleChange('package_info', '');
                      handleChange('engine_type', '');
                    }}
                    className={`w-full h-11 px-3 bg-background border rounded-lg outline-none text-sm ${errors.brand ? 'border-destructive' : 'border-border focus:border-primary'}`}
                    data-testid="car-brand-select"
                  >
                    <option value="">Seçiniz</option>
                    {carBrands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Model</label>
                  <select
                    value={formData.model}
                    onChange={(e) => {
                      handleChange('model', e.target.value);
                      handleChange('engine_type', '');
                      handleChange('package_info', '');
                    }}
                    className={`w-full h-11 px-3 bg-background border rounded-lg outline-none text-sm ${errors.model ? 'border-destructive' : 'border-border focus:border-primary'}`}
                    data-testid="car-model-select"
                  >
                    <option value="">Seçiniz</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Basic Info Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">KM</label>
                  <input
                    type="text"
                    value={formData.km}
                    onChange={(e) => handleNumberChange('km', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    placeholder="0"
                    data-testid="car-km-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Yakıt</label>
                  <select
                    value={formData.fuel_type}
                    onChange={(e) => handleChange('fuel_type', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    data-testid="car-fuel-select"
                  >
                    {fuelTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Vites</label>
                  <select
                    value={formData.gear}
                    onChange={(e) => handleChange('gear', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    data-testid="car-gear-select"
                  >
                    <option value="">Seçiniz</option>
                    {availableGears.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Giriş Tarihi</label>
                  <input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => handleChange('entry_date', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    data-testid="car-entry-date-input"
                  />
                </div>
              </div>

              {/* Basic Info Row 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Motor</label>
                  <select
                    value={formData.engine_type}
                    onChange={(e) => handleChange('engine_type', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    data-testid="car-engine-select"
                  >
                    <option value="">Seçiniz</option>
                    {availableEngines.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Araç Paketi/Versiyonu</label>
                  <select
                    value={formData.package_info}
                    onChange={(e) => handleChange('package_info', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    data-testid="car-package-select"
                  >
                    <option value="">Seçiniz</option>
                    {availablePackages.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Muayene Tarihi & Bildirim */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-2">Muayene Tarihi</label>
                  <input
                    type="date"
                    value={formData.inspection_date}
                    onChange={(e) => handleChange('inspection_date', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    data-testid="car-inspection-date-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Kaç Gün Önce Bildirim?</label>
                  <select
                    value={formData.inspection_notification_days}
                    onChange={(e) => handleChange('inspection_notification_days', parseInt(e.target.value))}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    disabled={!formData.inspection_date}
                    data-testid="inspection-notification-days"
                  >
                    <option value={7}>7 gün önce</option>
                    <option value={15}>15 gün önce</option>
                    <option value={30}>30 gün önce</option>
                    <option value={45}>45 gün önce</option>
                    <option value={60}>60 gün önce</option>
                  </select>
                  {!formData.inspection_date && (
                    <p className="text-xs text-muted-foreground mt-1">Önce muayene tarihi seçin</p>
                  )}
                </div>
              </div>

              {/* Kasa Tipi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Kasa Tipi</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) => handleChange('vehicle_type', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    data-testid="car-type-select"
                  >
                    {vehicleTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* İl / İlçe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">İl</label>
                  <select
                    value={formData.province}
                    onChange={(e) => {
                      handleChange('province', e.target.value);
                      handleChange('district', '');
                    }}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    data-testid="car-province-select"
                  >
                    <option value="">Seçiniz</option>
                    {provinceList.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">İlçe</label>
                  <select
                    value={formData.district}
                    onChange={(e) => handleChange('district', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    disabled={!formData.province}
                    data-testid="car-district-select"
                  >
                    <option value="">Seçiniz</option>
                    {availableDistricts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Insurance Dates */}
              <div className="p-3 sm:p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-blue-400">Sigorta Başlangıç Tarihi</label>
                    <input
                      type="date"
                      value={formData.insurance_start}
                      onChange={(e) => handleChange('insurance_start', e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                      data-testid="car-insurance-start-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-blue-400">Sigorta Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={formData.insurance_end}
                      onChange={(e) => handleChange('insurance_end', e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                      data-testid="car-insurance-end-input"
                    />
                  </div>
                </div>
              </div>

              {/* Fatura Bilgileri */}
              <div className="p-3 sm:p-4 bg-primary/10 border border-primary/30 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_invoiced"
                    checked={formData.is_invoiced}
                    onChange={(e) => handleChange('is_invoiced', e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-background cursor-pointer"
                    data-testid="is-invoiced-checkbox"
                  />
                  <label htmlFor="is_invoiced" className="text-sm font-semibold text-primary cursor-pointer">
                    Faturalı Alım
                  </label>
                </div>
                
                {formData.is_invoiced && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-2">Fatura No *</label>
                        <input
                          type="text"
                          value={formData.invoice_number}
                          onChange={(e) => handleChange('invoice_number', e.target.value)}
                          className={`w-full h-11 px-3 bg-background border rounded-lg outline-none text-sm ${errors.invoice_number ? 'border-destructive' : 'border-border focus:border-primary'}`}
                          placeholder="FTR2024001"
                          data-testid="invoice-number-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Fatura Tarihi *</label>
                        <input
                          type="date"
                          value={formData.invoice_date}
                          onChange={(e) => handleChange('invoice_date', e.target.value)}
                          className={`w-full h-11 px-3 bg-background border rounded-lg outline-none text-sm ${errors.invoice_date ? 'border-destructive' : 'border-border focus:border-primary'}`}
                          data-testid="invoice-date-input"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-2">Satıcı Adı/Firma *</label>
                        <input
                          type="text"
                          value={formData.invoice_seller_name}
                          onChange={(e) => handleChange('invoice_seller_name', e.target.value)}
                          className={`w-full h-11 px-3 bg-background border rounded-lg outline-none text-sm ${errors.invoice_seller_name ? 'border-destructive' : 'border-border focus:border-primary'}`}
                          placeholder="Ahmet Yılmaz veya ABC Otomotiv Ltd."
                          data-testid="invoice-seller-name-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">TC / Vergi No *</label>
                        <input
                          type="text"
                          value={formData.invoice_seller_tax_id}
                          onChange={(e) => handleChange('invoice_seller_tax_id', e.target.value)}
                          className={`w-full h-11 px-3 bg-background border rounded-lg outline-none text-sm ${errors.invoice_seller_tax_id ? 'border-destructive' : 'border-border focus:border-primary'}`}
                          placeholder="12345678901 veya 1234567890"
                          data-testid="invoice-seller-tax-id-input"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Satıcı Adresi *</label>
                      <textarea
                        value={formData.invoice_seller_address}
                        onChange={(e) => handleChange('invoice_seller_address', e.target.value)}
                        className={`w-full h-20 p-3 bg-background border rounded-lg outline-none resize-none text-sm ${errors.invoice_seller_address ? 'border-destructive' : 'border-border focus:border-primary'}`}
                        placeholder="Tam adres..."
                        data-testid="invoice-seller-address-input"
                      />
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      ℹ️ Fatura tutarı alış fiyatı ile aynı olacaktır. Faturayı PDF olarak görüntüleyebilir veya yazdırabilirsiniz.
                    </p>
                  </div>
                )}
              </div>

              {/* Muayene ve Sigorta Tarihleri */}
              <div className="p-3 sm:p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-4">
                <h4 className="font-semibold text-sm text-blue-400">📅 Muayene ve Sigorta Takibi</h4>
                
                {/* Tarih Seçimi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Muayene Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={formData.muayene_tarihi}
                      onChange={(e) => handleChange('muayene_tarihi', e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                      data-testid="muayene-tarihi-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Sigorta Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={formData.sigorta_bitis_tarihi}
                      onChange={(e) => handleChange('sigorta_bitis_tarihi', e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                      data-testid="sigorta-bitis-tarihi-input"
                    />
                  </div>
                </div>

                {/* Muayene Hatırlatmaları */}
                {formData.muayene_tarihi && (
                  <div className="border border-blue-500/20 rounded-lg p-3 bg-background/50">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-semibold text-blue-400">Muayene Hatırlatmaları</h5>
                      <button
                        type="button"
                        onClick={() => {
                          const newReminder = {
                            id: `rem_${Date.now()}`,
                            date: '',
                            time: '09:00'
                          };
                          handleChange('muayene_reminders', [...(formData.muayene_reminders || []), newReminder]);
                        }}
                        className="text-xs px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors"
                      >
                        + Hatırlatma Ekle
                      </button>
                    </div>
                    
                    {formData.muayene_reminders && formData.muayene_reminders.length > 0 ? (
                      <div className="space-y-2">
                        {formData.muayene_reminders.map((reminder, index) => (
                          <div key={reminder.id} className="flex items-center gap-2">
                            <input
                              type="date"
                              value={reminder.date}
                              onChange={(e) => {
                                const updated = [...formData.muayene_reminders];
                                updated[index].date = e.target.value;
                                handleChange('muayene_reminders', updated);
                              }}
                              className="flex-1 h-9 px-2 bg-background border border-border rounded text-xs"
                              placeholder="Tarih"
                            />
                            <input
                              type="time"
                              value={reminder.time}
                              onChange={(e) => {
                                const updated = [...formData.muayene_reminders];
                                updated[index].time = e.target.value;
                                handleChange('muayene_reminders', updated);
                              }}
                              className="w-24 h-9 px-2 bg-background border border-border rounded text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = formData.muayene_reminders.filter((_, i) => i !== index);
                                handleChange('muayene_reminders', updated);
                              }}
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Henüz hatırlatma eklenmedi
                      </p>
                    )}
                  </div>
                )}

                {/* Sigorta Hatırlatmaları */}
                {formData.sigorta_bitis_tarihi && (
                  <div className="border border-blue-500/20 rounded-lg p-3 bg-background/50">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-semibold text-blue-400">Sigorta Hatırlatmaları</h5>
                      <button
                        type="button"
                        onClick={() => {
                          const newReminder = {
                            id: `rem_${Date.now()}`,
                            date: '',
                            time: '09:00'
                          };
                          handleChange('sigorta_reminders', [...(formData.sigorta_reminders || []), newReminder]);
                        }}
                        className="text-xs px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors"
                      >
                        + Hatırlatma Ekle
                      </button>
                    </div>
                    
                    {formData.sigorta_reminders && formData.sigorta_reminders.length > 0 ? (
                      <div className="space-y-2">
                        {formData.sigorta_reminders.map((reminder, index) => (
                          <div key={reminder.id} className="flex items-center gap-2">
                            <input
                              type="date"
                              value={reminder.date}
                              onChange={(e) => {
                                const updated = [...formData.sigorta_reminders];
                                updated[index].date = e.target.value;
                                handleChange('sigorta_reminders', updated);
                              }}
                              className="flex-1 h-9 px-2 bg-background border border-border rounded text-xs"
                              placeholder="Tarih"
                            />
                            <input
                              type="time"
                              value={reminder.time}
                              onChange={(e) => {
                                const updated = [...formData.sigorta_reminders];
                                updated[index].time = e.target.value;
                                handleChange('sigorta_reminders', updated);
                              }}
                              className="w-24 h-9 px-2 bg-background border border-border rounded text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = formData.sigorta_reminders.filter((_, i) => i !== index);
                                handleChange('sigorta_reminders', updated);
                              }}
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Henüz hatırlatma eklenmedi
                      </p>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  💡 <strong>Not:</strong> Belirlediğiniz tarih ve saatte bildirim alacaksınız.
                </p>
              </div>

              {/* Prices */}
              <div className="p-3 sm:p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-destructive">Alış Fiyatı *</label>
                    <input
                      type="text"
                      value={formData.purchase_price}
                      onChange={(e) => handleNumberChange('purchase_price', e.target.value)}
                      className={`w-full h-11 px-3 bg-background border rounded-lg outline-none text-sm ${errors.purchase_price ? 'border-destructive' : 'border-border focus:border-primary'}`}
                      placeholder="0"
                      data-testid="car-purchase-price-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-destructive">Satış Fiyatı *</label>
                    <input
                      type="text"
                      value={formData.sale_price}
                      onChange={(e) => handleNumberChange('sale_price', e.target.value)}
                      className={`w-full h-11 px-3 bg-background border rounded-lg outline-none text-sm ${errors.sale_price ? 'border-destructive' : 'border-border focus:border-primary'}`}
                      placeholder="0"
                      data-testid="car-sale-price-input"
                    />
                  </div>
                </div>
              </div>

              {/* ✅ Inline Masraf Girişi — Yeni araç eklerken kalem kalem masraf eklenebilir */}
              {!editingCar && (
                <div className="space-y-3 p-4 border border-amber-500/30 rounded-xl bg-amber-500/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-amber-600 flex items-center gap-2">
                        <Wallet size={16} /> Geliş Masrafları (Opsiyonel)
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Çekici, ekspertiz, boya gibi masraflar — araç kaydedildiğinde Kasa'dan otomatik düşülür.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          pending_expenses: [
                            ...(prev.pending_expenses || []),
                            { category: 'Genel Gider', amount: '', description: '', date: new Date().toISOString().split('T')[0] }
                          ]
                        }));
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 rounded-lg flex items-center gap-1.5"
                      data-testid="add-inline-expense-btn"
                    >
                      <span className="text-base leading-none">+</span> Masraf Ekle
                    </button>
                  </div>

                  {(formData.pending_expenses || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3 border border-dashed border-amber-500/30 rounded-lg">
                      Henüz masraf eklenmedi.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(formData.pending_expenses || []).map((exp, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-2 items-start"
                          data-testid={`inline-expense-row-${idx}`}
                        >
                          <select
                            value={exp.category}
                            onChange={(e) => {
                              const next = [...formData.pending_expenses];
                              next[idx] = { ...next[idx], category: e.target.value };
                              setFormData((prev) => ({ ...prev, pending_expenses: next }));
                            }}
                            className="col-span-4 sm:col-span-3 h-10 px-2 bg-background border border-border rounded-lg text-xs focus:border-amber-500 outline-none"
                            data-testid={`inline-expense-category-${idx}`}
                          >
                            {INLINE_EXPENSE_CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={exp.amount}
                            onChange={(e) => {
                              const next = [...formData.pending_expenses];
                              next[idx] = { ...next[idx], amount: formatNumberInput(e.target.value) };
                              setFormData((prev) => ({ ...prev, pending_expenses: next }));
                            }}
                            placeholder="Tutar ₺"
                            className="col-span-3 sm:col-span-2 h-10 px-2 bg-background border border-border rounded-lg text-xs focus:border-amber-500 outline-none tabular-nums"
                            data-testid={`inline-expense-amount-${idx}`}
                          />
                          <input
                            type="text"
                            value={exp.description}
                            onChange={(e) => {
                              const next = [...formData.pending_expenses];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setFormData((prev) => ({ ...prev, pending_expenses: next }));
                            }}
                            placeholder="Açıklama"
                            className="col-span-4 sm:col-span-6 h-10 px-2 bg-background border border-border rounded-lg text-xs focus:border-amber-500 outline-none"
                            data-testid={`inline-expense-desc-${idx}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = formData.pending_expenses.filter((_, i) => i !== idx);
                              setFormData((prev) => ({ ...prev, pending_expenses: next }));
                            }}
                            className="col-span-1 h-10 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-lg"
                            data-testid={`inline-expense-remove-${idx}`}
                            title="Sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}

                      <div className="flex justify-end pt-2 border-t border-amber-500/20 text-xs">
                        <span className="text-muted-foreground mr-2">Toplam Masraf:</span>
                        <span className="font-bold text-amber-600 tabular-nums">
                          {(formData.pending_expenses || [])
                            .reduce((sum, e) => sum + parseNumber(e.amount || 0), 0)
                            .toLocaleString('tr-TR')} ₺
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full h-24 p-3 bg-background border border-border rounded-lg outline-none focus:border-primary resize-none text-sm"
                  placeholder="Araç hakkında..."
                  data-testid="car-description-input"
                />
              </div>
            </div>
          )}

          {/* Expertise Tab */}
          {activeTab === 'expertise' && (
            <div className="space-y-6 py-4">
              {/* SVG Car Diagram */}
              <div className="p-4 bg-muted/20 border border-border rounded-xl">
                <CarExpertiseDiagram
                  expertiseParts={formData.expertise?.parts || {}}
                  onChange={handleExpertiseChange}
                />
              </div>

              {/* Mechanical Parts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {mechanicalParts.map((part) => (
                  <div key={part.id}>
                    <label className="block text-sm font-medium mb-2">{part.name}</label>
                    <select
                      value={formData.expertise?.mechanical?.[part.id] || 'Orijinal'}
                      onChange={(e) => handleMechanicalChange(part.id, e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                      data-testid={`mechanical-${part.id}`}
                    >
                      {mechanicalStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium mb-2">Ekspertiz Puanı (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.expertise_score}
                    onChange={(e) => handleChange('expertise_score', parseInt(e.target.value) || 0)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                    data-testid="expertise-score-input"
                  />
                </div>
              </div>

              {/* Tramer */}
              <div className="p-3 sm:p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <label className="block text-sm font-medium mb-2 text-amber-400">Tramer Kayıt Tutarı (TL)</label>
                <input
                  type="text"
                  value={formData.tramer_amount}
                  onChange={(e) => handleNumberChange('tramer_amount', e.target.value)}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                  placeholder="0"
                  data-testid="tramer-amount-input"
                />
                <p className="text-xs text-amber-400/70 mt-1">Araç tramer kaydı varsa tutarını girin</p>
              </div>

              {/* Ekspertiz Notları */}
              <div>
                <label className="block text-sm font-medium mb-2">Ekspertiz Notları</label>
                <textarea
                  value={formData.expertise_notes}
                  onChange={(e) => handleChange('expertise_notes', e.target.value)}
                  className="w-full h-24 p-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary resize-none"
                  placeholder="Ek notlar..."
                  data-testid="expertise-notes-input"
                />
              </div>
            </div>
          )}

          {/* Photos Tab */}
          {activeTab === 'photos' && (
            <PhotoUploadTab formData={formData} handleChange={handleChange} />
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1 bg-border" />
                <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  Araç Belgeleri
                </h4>
                <div className="h-px flex-1 bg-border" />
              </div>

              {[
                { id: 'ruhsat', label: 'Ruhsat', icon: '📋' },
                { id: 'muayene', label: 'Muayene Belgesi', icon: '✅' },
                { id: 'sigorta', label: 'Sigorta Poliçesi', icon: '🛡️' },
                { id: 'ekspertiz', label: 'Ekspertiz Raporu', icon: '📊' },
                { id: 'vekaletname', label: 'Vekaletname', icon: '📝' },
                { id: 'diger', label: 'Diğer Belgeler', icon: '📁' }
              ].map((doc) => (
                <DocumentCategory
                  key={doc.id}
                  doc={doc}
                  docs={formData.documents?.[doc.id] || []}
                  formData={formData}
                  handleChange={handleChange}
                />
              ))}

              <p className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                💡 <strong>İpucu:</strong> Her belge kategorisi için maksimum 50MB boyutunda dosya yükleyebilirsiniz. 
                PDF ve görsel dosyalar desteklenmektedir.
              </p>
            </div>
          )}

          {/* Ownership Tab */}
          {activeTab === 'ownership' && (
            <div className="space-y-6 py-4">
              {/* Ownership Type */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <label className="flex-1">
                  <input
                    type="radio"
                    name="ownership"
                    value="stock"
                    checked={formData.ownership === 'stock'}
                    onChange={() => handleChange('ownership', 'stock')}
                    className="sr-only peer"
                  />
                  <div className="p-4 sm:p-6 rounded-xl border-2 border-border peer-checked:border-primary peer-checked:bg-primary/10 cursor-pointer transition-all text-center">
                    <Car size={28} className="mx-auto mb-2" />
                    <p className="font-semibold text-sm sm:text-base">Stok Araç</p>
                    <p className="text-xs text-muted-foreground mt-1">Galeriye ait araç</p>
                  </div>
                </label>
                <label className="flex-1">
                  <input
                    type="radio"
                    name="ownership"
                    value="consignment"
                    checked={formData.ownership === 'consignment'}
                    onChange={() => handleChange('ownership', 'consignment')}
                    className="sr-only peer"
                  />
                  <div className="p-4 sm:p-6 rounded-xl border-2 border-border peer-checked:border-primary peer-checked:bg-primary/10 cursor-pointer transition-all text-center">
                    <Users size={28} className="mx-auto mb-2" />
                    <p className="font-semibold text-sm sm:text-base">Konsinye</p>
                    <p className="text-xs text-muted-foreground mt-1">Araç sahibine ait</p>
                  </div>
                </label>
              </div>

              {/* Consignment Owner Info */}
              {formData.ownership === 'consignment' && (
                <div className="p-3 sm:p-4 bg-muted/50 rounded-xl space-y-4">
                  <h4 className="font-semibold">Araç Sahibi Bilgileri</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Araç Sahibi Adı</label>
                      <input
                        type="text"
                        value={formData.owner_name}
                        onChange={(e) => handleChange('owner_name', e.target.value)}
                        className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                        placeholder="Sahibi adı"
                        data-testid="car-owner-name-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Sahibi Telefon</label>
                      <input
                        type="tel"
                        value={formData.owner_phone}
                        onChange={(e) => handleChange('owner_phone', formatPhoneInput(e.target.value))}
                        className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                        placeholder="0532 XXX XX XX"
                        maxLength={14}
                        data-testid="car-owner-phone-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Araç Sahibine Ödenecek (₺)</label>
                      <input
                        type="text"
                        value={formData.purchase_price}
                        onChange={(e) => handleNumberChange('purchase_price', e.target.value)}
                        className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                        placeholder="0"
                        data-testid="car-owner-payment-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Komisyon Oranı (%)</label>
                      <input
                        type="number"
                        value={formData.commission_rate}
                        onChange={(e) => handleChange('commission_rate', e.target.value)}
                        className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                        placeholder="5"
                        min="0"
                        max="100"
                        data-testid="car-commission-input"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sale Info Tab - Her zaman görünür (satılmamış araçlar için "Çalışan Payı" planlama) */}
          {activeTab === 'sale_info' && editingCar && (
            <div className="space-y-6 py-4">
              {editingCar.status === 'Satıldı' ? (
                <div className="bg-success/10 border border-success/30 rounded-xl p-4">
                  <h4 className="font-semibold text-success mb-1">✓ Araç Satıldı</h4>
                  <p className="text-sm text-muted-foreground">
                    Satış Tarihi: {editingCar.sold_date ? new Date(editingCar.sold_date).toLocaleDateString('tr-TR') : 'Belirtilmemiş'}
                  </p>
                  {editingCar.customer_name && (
                    <p className="text-sm text-muted-foreground">
                      Müşteri: {editingCar.customer_name}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <h4 className="font-semibold text-primary mb-1">Çalışan Payı / Satışı Yapan</h4>
                  <p className="text-sm text-muted-foreground">
                    Bu alanlar araç satıldığında otomatik uygulanacaktır. İsterseniz şimdiden planlayabilirsiniz.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Çalışan Payı (₺)</label>
                  <input
                    type="text"
                    value={formData.employee_share}
                    onChange={(e) => handleNumberChange('employee_share', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    placeholder="0"
                    data-testid="employee-share-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Satışı Yapan</label>
                  <input
                    type="text"
                    value={formData.sold_by || ''}
                    onChange={(e) => handleChange('sold_by', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                    placeholder="Çalışan adı"
                    data-testid="sold-by-input"
                  />
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                💡 <strong>Not:</strong> Çalışan payı ve satışı yapan bilgileri güncellenebilir.
              </div>
            </div>
          )}
        </form>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 sm:gap-3 pt-4 border-t border-border px-4 sm:px-6 pb-4 sm:pb-6">
          {/* Sol: Mevcut araç düzenleniyorsa Masraf Görüntüle butonu (yeni araç eklerken inline form var) */}
          <div>
            {editingCar?.id && (
              <button
                type="button"
                onClick={() => setExpensesModal({ open: true, carId: editingCar.id, plate: editingCar.plate || formData.plate })}
                className="px-4 sm:px-5 py-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors text-sm font-semibold flex items-center gap-2"
                data-testid="open-expenses-btn"
              >
                <Wallet size={16} />
                Masraf Ekle / Görüntüle
              </button>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-6 py-3 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors text-sm sm:text-base"
              data-testid="cancel-car-btn"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 sm:px-6 py-3 rounded-lg bg-foreground text-background font-semibold hover:bg-foreground/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
              data-testid="save-car-btn"
            >
              <FileText size={18} />
              {loading ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </DialogContent>

      {/* ✅ Masraf modal — kaydedilen aracın id'siyle açılır */}
      {expensesModal.open && (
        <VehicleExpensesModal
          isOpen={expensesModal.open}
          onClose={() => setExpensesModal({ open: false, carId: null, plate: '' })}
          car={{ id: expensesModal.carId, plate: expensesModal.plate }}
        />
      )}
    </Dialog>
  );
};

export default AddCarModal;
