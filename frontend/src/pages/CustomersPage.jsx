import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatDate, formatCurrency, downloadBlob } from '../utils/helpers';
import { 
  Search, 
  Users, 
  Phone, 
  MoreVertical,
  Edit,
  Trash2,
  Car,
  Plus,
  Download,
  MessageCircle,
  CheckCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { exportAPI } from '../services/api';

const CustomerCard = ({ customer, cars, onEdit, onDelete }) => {
  const interestedCar = cars.find(c => c.id === customer.interested_car_id);
  
  const getTypeColor = (type) => {
    switch (type) {
      case 'Potansiyel':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'Aktif':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'Satış Yapıldı':
        return 'bg-success/20 text-success border-success/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div 
      className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-all"
      data-testid={`customer-card-${customer.id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="font-heading font-bold text-lg text-primary">
              {customer.name?.charAt(0)?.toUpperCase() || 'M'}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{customer.name}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Phone size={14} />
              {customer.phone || '-'}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
              <MoreVertical size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit?.(customer)}>
              <Edit size={16} className="mr-2" />
              Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete?.(customer)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 size={16} className="mr-2" />
              Sil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-3">
        <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border ${getTypeColor(customer.type)}`}>
          {customer.type}
        </span>

        {interestedCar && (
          <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
            <Car size={18} className="text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {interestedCar.brand} {interestedCar.model}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(interestedCar.sale_price)}
              </p>
            </div>
          </div>
        )}

        {customer.notes && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {customer.notes}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Eklenme: {formatDate(customer.created_at)}
        </p>

        {customer.phone && (
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`https://wa.me/${customer.phone.replace(/\s/g, '').replace(/^0/, '90')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 transition-colors"
              data-testid={`whatsapp-btn-${customer.id}`}
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
            <a
              href={`sms:${customer.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
              data-testid={`sms-btn-${customer.id}`}
            >
              <Phone size={14} />
              SMS
            </a>
            <a
              href={`tel:${customer.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors"
              data-testid={`call-btn-${customer.id}`}
            >
              <Phone size={14} />
              Ara
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

const CustomersPage = ({ onAddCustomer, onEditCustomer, onDeleteCustomer }) => {
  const { customers, cars } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const filteredCustomers = useMemo(() => {
    let result = customers.filter(c => !c.deleted);

    // Type filter
    if (filterType !== 'all') {
      result = result.filter(c => c.type === filterType);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name?.toLowerCase().includes(query) ||
        c.phone?.includes(query)
      );
    }

    // Sort by newest
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return result;
  }, [customers, searchQuery, filterType]);

  const activeCars = cars.filter(c => !c.deleted && c.status !== 'Satıldı');

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="İsim veya telefon ara..."
            className="w-full h-12 pl-12 pr-4 bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            data-testid="customer-search"
          />
        </div>

        {/* Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-12 px-4 bg-card border border-border rounded-lg focus:border-primary outline-none text-sm"
          data-testid="customer-filter"
        >
          <option value="all">Tümü</option>
          <option value="Potansiyel">Potansiyel</option>
          <option value="Aktif">Aktif</option>
          <option value="Satış Yapıldı">Satış Yapıldı</option>
        </select>

        {/* Add Button */}
        <button
          onClick={onAddCustomer}
          className="h-12 px-6 gradient-gold rounded-lg font-semibold text-primary-foreground shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
          data-testid="add-customer-btn"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Müşteri Ekle</span>
        </button>
      </div>

      {/* Stats + Export */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm flex-wrap">
          <span className="text-muted-foreground">
            Toplam: <strong className="text-foreground">{filteredCustomers.length}</strong>
          </span>
          <span className="text-warning">
            Pot: {customers.filter(c => !c.deleted && c.type === 'Potansiyel').length}
          </span>
          <span className="text-primary">
            Aktif: {customers.filter(c => !c.deleted && c.type === 'Aktif').length}
          </span>
          <span className="text-success">
            Satış: {customers.filter(c => !c.deleted && c.type === 'Satış Yapıldı').length}
          </span>
        </div>
        <button
          onClick={async () => {
            setExporting(true);
            setDownloadSuccess(false);
            try {
              const res = await exportAPI.customers();
              downloadBlob(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'musteriler.docx');
              setDownloadSuccess(true);
              setTimeout(() => setDownloadSuccess(false), 4000);
            } catch (e) {
              console.error(e);
              alert('Dosya indirme hatası: ' + (e.message || 'Bilinmeyen hata'));
            } finally {
              setExporting(false);
            }
          }}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          data-testid="export-customers-btn"
        >
          {downloadSuccess ? (
            <><CheckCircle size={16} className="text-success" /> İndirildi!</>
          ) : (
            <><Download size={16} className={exporting ? 'animate-bounce' : ''} /> {exporting ? 'İndiriliyor...' : 'Word'}</>
          )}
        </button>
      </div>

      {/* Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Users size={32} className="text-muted-foreground" />
          </div>
          <h3 className="font-heading font-semibold text-lg mb-2">Müşteri Bulunamadı</h3>
          <p className="text-muted-foreground text-sm">
            {searchQuery ? 'Arama kriterlerine uygun müşteri yok.' : 'Henüz müşteri eklenmemiş.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              cars={activeCars}
              onEdit={onEditCustomer}
              onDelete={onDeleteCustomer}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
