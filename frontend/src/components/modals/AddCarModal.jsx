import React, { useState, useEffect } from 'react';
import { X, Car, FileText, Camera, Users, CheckCircle, Upload, Trash2, Loader2 } from 'lucide-react';
import { formatNumberInput, parseNumber } from '../../utils/helpers';
import { carBrands, carModels, engineTypes, gearTypes, fuelTypes, vehicleTypes, modelYears, getEnginesForModel, getPackagesForModel } from '../../data/carData';
import { provinceList, getDistrictsByProvince } from '../../data/turkeyData';
import CarExpertiseDiagram from '../CarExpertiseDiagram';
import { fileAPI } from '../../services/api';

const PhotoUploadTab = ({ formData, handleChange }) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newPhotos = [...(formData.photos || [])];
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) continue;
        const fd = new FormData();
        fd.append('file', file);
        const res = await fileAPI.upload(fd);
        newPhotos.push(res.data.path);
      }
      handleChange('photos', newPhotos);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
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
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        ) : (
          <>
            <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">Fotoğraf yüklemek için tıklayın veya sürükleyin</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP (max. 10MB)</p>
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
  expertise_notes: ''
};

const AddCarModal = ({ isOpen, onClose, onSave, editingCar = null }) => {
  const [formData, setFormData] = useState(defaultFormData);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (editingCar) {
      setFormData({
        ...defaultFormData,
        ...editingCar,
        km: formatNumberInput(editingCar.km),
        purchase_price: formatNumberInput(editingCar.purchase_price),
        sale_price: formatNumberInput(editingCar.sale_price),
        expertise: editingCar.expertise || defaultFormData.expertise,
      });
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
      const submitData = {
        ...formData,
        km: formData.km?.replace(/[^\d]/g, '') || '0',
        purchase_price: parseNumber(formData.purchase_price),
        sale_price: parseNumber(formData.sale_price),
        tramer_amount: parseNumber(formData.tramer_amount),
        commission_rate: parseInt(formData.commission_rate) || (formData.ownership === 'consignment' ? 5 : 0),
        year: parseInt(formData.year) || new Date().getFullYear(),
        expertise_score: parseInt(formData.expertise_score) || 0,
      };
      
      await onSave(submitData);
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
  const availableDistricts = getDistrictsByProvince(formData.province);

  const tabs = [
    { id: 'general', label: 'Genel Bilgiler', icon: FileText },
    { id: 'expertise', label: 'Ekspertiz', icon: CheckCircle },
    { id: 'photos', label: 'Fotoğraflar', icon: Camera },
    { id: 'ownership', label: 'Sahiplik / Konsinye', icon: Users },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Car size={24} className="text-primary" />
            {editingCar ? 'Araç Düzenle' : 'Yeni Araç Girişi'}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border mt-4 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <Icon size={16} />
                <span className="tab-label-full">{tab.label}</span>
                <span className="tab-label-short">{
                  tab.id === 'general' ? 'Genel' :
                  tab.id === 'expertise' ? 'Ekspertiz' :
                  tab.id === 'photos' ? 'Foto' :
                  'Sahiplik'
                }</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-1">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-4 py-4">
              {/* Basic Info Row 1 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
                    {gearTypes.map(type => (
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

              {/* Muayene Tarihi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
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
                        onChange={(e) => handleChange('owner_phone', e.target.value)}
                        className="w-full h-11 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                        placeholder="0532 XXX XX XX"
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
        </form>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-border mt-4">
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
      </DialogContent>
    </Dialog>
  );
};

export default AddCarModal;
