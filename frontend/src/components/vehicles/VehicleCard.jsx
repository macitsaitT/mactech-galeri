import React from 'react';
import { formatCurrency, getStatusColor, getOwnershipBadge } from '../../utils/helpers';
import { 
  Fuel, 
  Gauge, 
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Receipt,
  CreditCard,
  ShoppingCart,
  Car,
  FileText,
  RotateCcw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { exportAPI, fileAPI } from '../../services/api';

const VehicleCard = ({ 
  car, 
  onEdit, 
  onDelete, 
  onView, 
  onExpenses, 
  onDeposit, 
  onSale,
  onCancelSale,
  showActions = true 
}) => {
  const statusColor = getStatusColor(car.status);
  const ownershipBadge = getOwnershipBadge(car.ownership);
  
  // Photo display - support both URLs and storage paths
  const getPhotoUrl = () => {
    const photo = car.photos?.[0];
    if (!photo) return null;
    if (photo.startsWith('http')) return photo;
    return fileAPI.getUrl(photo);
  };
  const imageUrl = getPhotoUrl();

  return (
    <div 
      className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all duration-300 group"
      data-testid={`vehicle-card-${car.id}`}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={`${car.brand} ${car.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Car size={48} className="text-muted-foreground/30" />
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={`px-2 py-1 text-xs font-bold rounded-full border ${statusColor}`}>
            {car.status}
          </span>
          <span className={`px-2 py-1 text-xs font-bold rounded-full border ${ownershipBadge.class}`}>
            {ownershipBadge.label}
          </span>
        </div>

        {/* Actions Menu */}
        {showActions && (
          <div className="absolute top-3 right-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="p-2 rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-background transition-colors"
                  data-testid={`vehicle-menu-${car.id}`}
                >
                  <MoreVertical size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onView?.(car)} data-testid={`view-${car.id}`}>
                  <Eye size={16} className="mr-2" />
                  Detay Görüntüle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit?.(car)} data-testid={`edit-${car.id}`}>
                  <Edit size={16} className="mr-2" />
                  Düzenle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExpenses?.(car)} data-testid={`expenses-${car.id}`}>
                  <Receipt size={16} className="mr-2" />
                  Masraflar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={async () => {
                    try {
                      const res = await exportAPI.expertisePdf(car.id);
                      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `ekspertiz_${car.plate?.replace(/\s/g, '_') || car.id}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) { console.error(e); }
                  }}
                  data-testid={`pdf-${car.id}`}
                >
                  <FileText size={16} className="mr-2" />
                  Ekspertiz PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {car.status === 'Stokta' && (
                  <>
                    <DropdownMenuItem onClick={() => onDeposit?.(car)} data-testid={`deposit-${car.id}`}>
                      <CreditCard size={16} className="mr-2" />
                      Kapora Al
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSale?.(car)} data-testid={`sale-${car.id}`}>
                      <ShoppingCart size={16} className="mr-2" />
                      Satış Yap
                    </DropdownMenuItem>
                  </>
                )}
                {car.status === 'Kapora Alındı' && (
                  <>
                    <DropdownMenuItem onClick={() => onDeposit?.(car)} data-testid={`deposit-${car.id}`}>
                      <CreditCard size={16} className="mr-2" />
                      Kapora Düzenle
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSale?.(car)} data-testid={`sale-${car.id}`}>
                      <ShoppingCart size={16} className="mr-2" />
                      Satış Tamamla
                    </DropdownMenuItem>
                  </>
                )}
                {car.status === 'Satıldı' && (
                  <DropdownMenuItem 
                    onClick={() => onCancelSale?.(car)} 
                    className="text-amber-500 focus:text-amber-500"
                    data-testid={`cancel-sale-${car.id}`}
                  >
                    <RotateCcw size={16} className="mr-2" />
                    Satışı İptal Et
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete?.(car)} 
                  className="text-destructive focus:text-destructive"
                  data-testid={`delete-${car.id}`}
                >
                  <Trash2 size={16} className="mr-2" />
                  Sil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title & Plate */}
        <div className="mb-3">
          <h3 className="font-heading font-bold text-lg leading-tight">
            {car.brand} {car.model}
          </h3>
          <p className="text-primary font-mono text-sm font-bold mt-1">
            {car.plate?.toUpperCase() || '-'}
          </p>
        </div>

        {/* Specs */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            {car.year}
          </span>
          <span className="flex items-center gap-1">
            <Gauge size={14} />
            {car.km || '0'} km
          </span>
          <span className="flex items-center gap-1">
            <Fuel size={14} />
            {car.fuel_type}
          </span>
        </div>

        {/* Price */}
        <div className="flex items-end justify-between pt-3 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Satış Fiyatı</p>
            <p className="font-heading font-bold text-xl text-primary tabular-nums">
              {formatCurrency(car.sale_price)}
            </p>
          </div>
        </div>

        {/* Sold by info */}
        {car.status === 'Satıldı' && car.sold_by_name && (
          <div className="mt-3 p-2.5 rounded-lg bg-success/10 border border-success/20" data-testid={`sold-by-info-${car.id}`}>
            <p className="text-xs text-success font-medium">
              Satan: {car.sold_by_name}
            </p>
            {car.sold_date && (
              <p className="text-xs text-success/80 mt-0.5">
                {car.sold_date}
              </p>
            )}
          </div>
        )}

        {/* Deposit info */}
        {car.deposit_amount > 0 && car.status !== 'Satıldı' && (
          <div className="mt-3 p-2.5 rounded-lg bg-warning/10 border border-warning/20" data-testid={`deposit-info-${car.id}`}>
            <p className="text-xs text-warning font-medium">
              Kapora: {formatCurrency(car.deposit_amount)}
            </p>
            {car.deposit_customer_name && (
              <p className="text-xs text-warning/80 mt-0.5">
                {car.deposit_customer_name} {car.deposit_date ? `- ${car.deposit_date}` : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleCard;
