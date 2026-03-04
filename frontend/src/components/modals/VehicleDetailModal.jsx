import React from 'react';
import { formatCurrency } from '../../utils/helpers';
import { fileAPI } from '../../services/api';
import {
  Car, Calendar, Gauge, Fuel, Settings, MapPin, Shield, FileText, X, User
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const statusLabels = {
  orijinal: { label: 'Orijinal', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  boyali: { label: 'Boyalı', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  degisen: { label: 'Değişen', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  lokal: { label: 'Lokal', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

const partNames = {
  on_tampon: 'Ön Tampon', kaput: 'Kaput', sol_on_camurluk: 'Sol Ön Çamurluk',
  sag_on_camurluk: 'Sağ Ön Çamurluk', sol_on_kapi: 'Sol Ön Kapı',
  sag_on_kapi: 'Sağ Ön Kapı', tavan: 'Tavan', sol_arka_kapi: 'Sol Arka Kapı',
  sag_arka_kapi: 'Sağ Arka Kapı', sol_arka_camurluk: 'Sol Arka Çamurluk',
  sag_arka_camurluk: 'Sağ Arka Çamurluk', bagaj: 'Bagaj', arka_tampon: 'Arka Tampon',
};

const VehicleDetailModal = ({ isOpen, onClose, car }) => {
  if (!car) return null;

  const getPhotoUrl = (photo) => {
    if (!photo) return null;
    if (photo.startsWith('http')) return photo;
    return fileAPI.getUrl(photo);
  };

  const expertiseParts = car.expertise?.parts || {};
  const mechanical = car.expertise?.mechanical || {};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="vehicle-detail-title">
            <Car size={24} className="text-primary" />
            {car.brand} {car.model} - {car.plate?.toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          {/* Photos */}
          {car.photos?.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="vehicle-detail-photos">
              {car.photos.map((photo, i) => (
                <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                  <img
                    src={getPhotoUrl(photo)}
                    alt={`${car.brand} ${car.model} - ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3" data-testid="vehicle-detail-info">
            <InfoRow icon={<Car size={16} />} label="Marka" value={car.brand} />
            <InfoRow icon={<Car size={16} />} label="Model" value={car.model} />
            <InfoRow icon={<Calendar size={16} />} label="Yıl" value={car.year} />
            <InfoRow icon={<FileText size={16} />} label="Plaka" value={car.plate?.toUpperCase()} />
            <InfoRow icon={<Gauge size={16} />} label="KM" value={`${car.km || '0'} km`} />
            <InfoRow icon={<Fuel size={16} />} label="Yakıt" value={car.fuel_type} />
            <InfoRow icon={<Settings size={16} />} label="Vites" value={car.gear} />
            <InfoRow icon={<Car size={16} />} label="Kasa" value={car.vehicle_type} />
            {car.engine_type && <InfoRow icon={<Settings size={16} />} label="Motor" value={car.engine_type} />}
            {car.package_info && <InfoRow icon={<FileText size={16} />} label="Paket" value={car.package_info} />}
            {car.province && <InfoRow icon={<MapPin size={16} />} label="İl" value={car.province} />}
            {car.district && <InfoRow icon={<MapPin size={16} />} label="İlçe" value={car.district} />}
          </div>

          {/* Status & Ownership */}
          <div className="flex gap-3 flex-wrap">
            <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-primary/20 text-primary border border-primary/30">
              {car.status}
            </span>
            <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-muted text-muted-foreground border border-border">
              {car.ownership === 'stock' ? 'Stok' : 'Konsinye'}
            </span>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="vehicle-detail-prices">
            <PriceCard label="Alış Fiyatı" value={car.purchase_price} />
            <PriceCard label="Satış Fiyatı" value={car.sale_price} accent />
            {car.deposit_amount > 0 && <PriceCard label="Kapora" value={car.deposit_amount} warning />}
          </div>

          {/* Deposit Customer Info */}
          {car.deposit_amount > 0 && car.deposit_customer_name && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg" data-testid="vehicle-detail-deposit-info">
              <p className="text-xs text-muted-foreground mb-1">Kapora Bilgisi</p>
              <p className="font-medium text-sm">{car.deposit_customer_name}</p>
              {car.deposit_date && <p className="text-xs text-muted-foreground">Tarih: {car.deposit_date}</p>}
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            {car.entry_date && <InfoRow icon={<Calendar size={16} />} label="Giriş Tarihi" value={car.entry_date} />}
            {car.sold_date && <InfoRow icon={<Calendar size={16} />} label="Satış Tarihi" value={car.sold_date} />}
            {car.inspection_date && <InfoRow icon={<Shield size={16} />} label="Muayene" value={car.inspection_date} />}
            {car.sold_by_name && <InfoRow icon={<User size={16} />} label="Satan Kişi" value={car.sold_by_name} />}
          </div>

          {/* Consignment Info */}
          {car.ownership === 'consignment' && (
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Araç Sahibi</p>
              <p className="font-medium">{car.owner_name || '-'}</p>
              {car.owner_phone && <p className="text-sm text-muted-foreground">{car.owner_phone}</p>}
              {car.commission_rate > 0 && <p className="text-sm text-muted-foreground">Komisyon: %{car.commission_rate}</p>}
            </div>
          )}

          {/* Expertise */}
          {Object.keys(expertiseParts).length > 0 && (
            <div data-testid="vehicle-detail-expertise">
              <h4 className="font-heading font-semibold mb-3">Kaporta Durumu</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(partNames).map(([key, name]) => {
                  const status = expertiseParts[key] || 'orijinal';
                  const s = statusLabels[status] || statusLabels.orijinal;
                  return (
                    <div key={key} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                      <span className="text-muted-foreground">{name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mechanical */}
          {Object.keys(mechanical).length > 0 && (
            <div>
              <h4 className="font-heading font-semibold mb-3">Mekanik Durum</h4>
              <div className="grid grid-cols-1 gap-2">
                {mechanical.motor && <InfoRow icon={<Settings size={16} />} label="Motor" value={mechanical.motor} />}
                {mechanical.sanziman && <InfoRow icon={<Settings size={16} />} label="Şanzıman" value={mechanical.sanziman} />}
                {mechanical.yuruyen && <InfoRow icon={<Settings size={16} />} label="Yürüyen" value={mechanical.yuruyen} />}
              </div>
            </div>
          )}

          {/* Score */}
          <div className="flex gap-4 items-center">
            <div className="text-center p-3 bg-muted/50 rounded-lg border border-border flex-1">
              <p className="text-xs text-muted-foreground">Ekspertiz Puanı</p>
              <p className="text-2xl font-bold text-primary">%{car.expertise_score || 95}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg border border-border flex-1">
              <p className="text-xs text-muted-foreground">Tramer</p>
              <p className="text-2xl font-bold">{formatCurrency(car.tramer_amount || 0)}</p>
            </div>
          </div>

          {/* Notes */}
          {car.expertise_notes && (
            <div className="p-3 bg-muted/30 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Ekspertiz Notları</p>
              <p className="text-sm">{car.expertise_notes}</p>
            </div>
          )}

          {/* Description */}
          {car.description && (
            <div className="p-3 bg-muted/30 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Açıklama</p>
              <p className="text-sm">{car.description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
    <span className="text-muted-foreground">{icon}</span>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm truncate">{value || '-'}</p>
    </div>
  </div>
);

const PriceCard = ({ label, value, accent, warning }) => (
  <div className={`p-3 rounded-lg border ${accent ? 'bg-primary/10 border-primary/30' : warning ? 'bg-warning/10 border-warning/30' : 'bg-muted/50 border-border'}`}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`font-heading font-bold text-lg tabular-nums ${accent ? 'text-primary' : warning ? 'text-warning' : ''}`}>
      {formatCurrency(value || 0)}
    </p>
  </div>
);

export default VehicleDetailModal;
