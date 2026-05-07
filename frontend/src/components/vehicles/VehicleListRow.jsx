import React from 'react';
import { formatCurrency, getStatusColor, getOwnershipBadge } from '../../utils/helpers';
import {
  Calendar, Gauge, Fuel, MoreVertical, Edit, Trash2, Eye, Receipt, CreditCard,
  ShoppingCart, Car, FileText, RotateCcw, Share2
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { exportAPI, fileAPI } from '../../services/api';

const VehicleListRow = ({
  car,
  onEdit,
  onDelete,
  onView,
  onExpenses,
  onDeposit,
  onSale,
  onCancelSale,
  onShare,
  onConsignmentPdf,
  showActions = true,
}) => {
  const statusColor = getStatusColor(car.status);
  const ownershipBadge = getOwnershipBadge(car.ownership);

  const getPhotoUrl = () => {
    const photo = car.photos?.[0];
    if (!photo) return null;
    if (photo.startsWith('http')) return photo;
    return fileAPI.getUrl(photo);
  };
  const imageUrl = getPhotoUrl();

  const stockDays = car.entry_date
    ? Math.max(0, Math.floor((new Date() - new Date(car.entry_date)) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div
      className="flex items-stretch gap-3 sm:gap-4 bg-card border border-border rounded-xl p-3 hover:border-primary/50 hover:shadow-md transition-all"
      data-testid={`vehicle-row-${car.id}`}
    >
      {/* Thumbnail */}
      <div className="relative shrink-0 w-24 h-20 sm:w-32 sm:h-24 rounded-lg overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${car.brand} ${car.model}`}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Car size={28} className="text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading font-bold text-sm sm:text-base truncate">
              {car.brand} {car.model}
            </h3>
            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full border ${statusColor}`}>
              {car.status}
            </span>
            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full border ${ownershipBadge.class}`}>
              {ownershipBadge.label}
            </span>
          </div>
          <p className="text-primary font-mono text-xs font-bold mt-0.5">{car.plate?.toUpperCase() || '-'}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
            <span className="flex items-center gap-1"><Calendar size={11} />{car.year}</span>
            <span className="flex items-center gap-1"><Gauge size={11} />{car.km || '0'} km</span>
            <span className="hidden sm:flex items-center gap-1"><Fuel size={11} />{car.fuel_type}</span>
            {stockDays !== null && car.status !== 'Satıldı' && (
              <span className="hidden sm:inline text-muted-foreground/80">· Stokta {stockDays} gün</span>
            )}
          </div>
        </div>
      </div>

      {/* Price + Actions */}
      <div className="flex flex-col items-end justify-between shrink-0 gap-2">
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Satış</p>
          <p className="font-heading font-bold text-sm sm:text-base text-primary tabular-nums">
            {formatCurrency(car.sale_price)}
          </p>
        </div>
        {showActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                data-testid={`vehicle-row-menu-${car.id}`}
              >
                <MoreVertical size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onView?.(car)}>
                <Eye size={16} className="mr-2" /> Detay Görüntüle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShare?.(car)}>
                <Share2 size={16} className="mr-2" /> WhatsApp Paylaş
              </DropdownMenuItem>
              {car.ownership === 'consignment' && (
                <DropdownMenuItem onClick={() => onConsignmentPdf?.(car)}>
                  <FileText size={16} className="mr-2" /> Konsinye Sözleşmesi
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit?.(car)}>
                  <Edit size={16} className="mr-2" /> Düzenle
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onExpenses?.(car)}>
                <Receipt size={16} className="mr-2" /> Masraflar
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
              >
                <FileText size={16} className="mr-2" /> Ekspertiz PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {car.status === 'Stokta' && (
                <>
                  <DropdownMenuItem onClick={() => onDeposit?.(car)}>
                    <CreditCard size={16} className="mr-2" /> Kapora Al
                  </DropdownMenuItem>
                  {onSale && (
                    <DropdownMenuItem onClick={() => onSale?.(car)}>
                      <ShoppingCart size={16} className="mr-2" /> Satış Yap
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {car.status === 'Kapora Alındı' && (
                <>
                  <DropdownMenuItem onClick={() => onDeposit?.(car)}>
                    <CreditCard size={16} className="mr-2" /> Kapora Düzenle
                  </DropdownMenuItem>
                  {onSale && (
                    <DropdownMenuItem onClick={() => onSale?.(car)}>
                      <ShoppingCart size={16} className="mr-2" /> Satış Tamamla
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {car.status === 'Satıldı' && onCancelSale && (
                <DropdownMenuItem
                  onClick={() => onCancelSale?.(car)}
                  className="text-amber-500 focus:text-amber-500"
                >
                  <RotateCcw size={16} className="mr-2" /> Satışı İptal Et
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete?.(car)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 size={16} className="mr-2" /> Sil
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

export default VehicleListRow;
