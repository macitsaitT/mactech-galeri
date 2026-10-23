import React, { useState, useMemo, useEffect } from 'react';
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
  CheckCircle,
  CreditCard,
  Check,
  X as XIcon
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import CustomerDetailModal from '../components/modals/CustomerDetailModal';
import { exportAPI, installmentsAPI } from '../services/api';
import InstallmentModal from '../components/modals/InstallmentModal';

const CustomerCard = ({ customer, cars, onEdit, onDelete, onOpenInstallments, onViewDetail, installmentSummary }) => {
  const interestedCar = cars.find(c => c.id === customer.interested_car_id);
  
  const getTypeColor = (type) => {
    switch (type) {
      case 'Potansiyel':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'Aktif':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'Satış Yapıldı':
        return 'bg-success/20 text-success border-success/30';
      case 'Satıcı':
        return 'bg-amber-500/20 text-amber-600 border-amber-500/30';
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
          <div
            className="cursor-pointer"
            onClick={() => onViewDetail?.(customer)}
            data-testid={`customer-title-${customer.id}`}
          >
            <h3 className="font-semibold text-foreground hover:text-primary transition-colors">{customer.name}</h3>
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
            <DropdownMenuItem onClick={() => onViewDetail?.(customer)} data-testid={`detail-menu-${customer.id}`}>
              <CreditCard size={16} className="mr-2" />
              Müşteri Detayı
            </DropdownMenuItem>
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit?.(customer)}>
                <Edit size={16} className="mr-2" />
                Düzenle
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onOpenInstallments?.(customer)}>
              <CreditCard size={16} className="mr-2" />
              Vadeli Satışlar
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete?.(customer)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={16} className="mr-2" />
                Sil
              </DropdownMenuItem>
            )}
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

        {/* ✅ Vadeli Satış Özeti */}
        {installmentSummary && installmentSummary.count > 0 && (
          <button
            onClick={() => onOpenInstallments?.(customer)}
            className="w-full p-3 rounded-lg bg-primary/5 border border-primary/30 hover:bg-primary/10 transition-colors text-left"
            data-testid={`installments-summary-${customer.id}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-primary shrink-0" />
                <span className="text-xs font-semibold text-primary">
                  {installmentSummary.count} Vadeli Satış
                </span>
              </div>
              <span className={`text-xs font-bold ${installmentSummary.remaining > 0 ? 'text-destructive' : 'text-success'}`}>
                Kalan: {formatCurrency(installmentSummary.remaining)}
              </span>
            </div>
          </button>
        )}

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
  const { customers, cars, deleteCustomer, user, hasPermission } = useApp();
  // ✅ Yetki kontrolleri
  const canAdd = user?.role === 'admin' || hasPermission('customers_add');
  const canEdit = user?.role === 'admin' || hasPermission('customers_edit');
  const canDelete = user?.role === 'admin' || hasPermission('customers_delete');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  // ✅ Toplu seçim & silme
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`${selectedIds.size} müşteriyi silmek istediğinize emin misiniz? (Çöp kutusuna gönderilecek)`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteCustomer(id, false);
      }
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch (e) {
      alert('Toplu silme hatası: ' + (e?.response?.data?.detail || e.message || 'Bilinmeyen'));
    } finally {
      setBulkDeleting(false);
    }
  };

  // ✅ Vadeli satışlar - tüm müşteriler için tek seferde çek
  const [installments, setInstallments] = useState([]);
  const [installmentDrawer, setInstallmentDrawer] = useState({ open: false, customer: null });
  const [installmentModal, setInstallmentModal] = useState({ open: false, mode: 'create', customerId: null, installmentId: null });
  // ✅ Müşteri detay modal state
  const [detailCustomerId, setDetailCustomerId] = useState(null);

  const refreshInstallments = async () => {
    try {
      const res = await installmentsAPI.list();
      setInstallments(res.data || []);
    } catch (_) {}
  };

  useEffect(() => { refreshInstallments(); }, []);

  // Müşteri başına özet
  const summaryByCustomer = useMemo(() => {
    const map = {};
    installments.forEach(i => {
      if (!map[i.customer_id]) map[i.customer_id] = { count: 0, total: 0, paid: 0, remaining: 0 };
      map[i.customer_id].count += 1;
      map[i.customer_id].total += Number(i.total_amount || 0);
      map[i.customer_id].paid += Number(i.paid_amount || 0) + Number(i.down_payment_amount || 0);
      map[i.customer_id].remaining += Number(i.remaining_amount || 0);
    });
    return map;
  }, [installments]);

  const handleOpenInstallments = (customer) => {
    setInstallmentDrawer({ open: true, customer });
  };

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
          <option value="Satıcı">Satıcı (Aldığımız)</option>
        </select>

        {/* Add Button — yetki kontrolü */}
        {canAdd && (
          <button
            onClick={onAddCustomer}
            className="h-12 px-6 gradient-gold rounded-lg font-semibold text-primary-foreground shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
            data-testid="add-customer-btn"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Müşteri Ekle</span>
          </button>
        )}
      </div>

      {/* Stats + Bulk Actions + Export */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm flex-wrap">
          <span className="text-muted-foreground">
            Toplam: <strong className="text-foreground">{filteredCustomers.length}</strong>
          </span>
          {selectionMode && selectedIds.size > 0 && (
            <span className="text-primary font-semibold" data-testid="selected-count">{selectedIds.size} seçildi</span>
          )}
          <span className="text-warning">
            Pot: {customers.filter(c => !c.deleted && c.type === 'Potansiyel').length}
          </span>
          <span className="text-primary">
            Aktif: {customers.filter(c => !c.deleted && c.type === 'Aktif').length}
          </span>
          <span className="text-success">
            Satış: {customers.filter(c => !c.deleted && c.type === 'Satış Yapıldı').length}
          </span>
          <span className="text-amber-600">
            Satıcı: {customers.filter(c => !c.deleted && c.type === 'Satıcı').length}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!selectionMode ? (
            <button
              onClick={() => { setSelectionMode(true); setSelectedIds(new Set()); }}
              className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-destructive/40 text-destructive text-xs font-semibold hover:bg-destructive/10 transition-colors"
              data-testid="customer-bulk-toggle-btn"
            >
              <Trash2 size={14} /> Toplu Sil
            </button>
          ) : (
            <>
              <button
                onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
                className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-border text-muted-foreground text-xs hover:bg-muted transition-colors"
                data-testid="customer-bulk-cancel-btn"
              >
                <XIcon size={14} /> İptal
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || bulkDeleting}
                className="flex items-center gap-1.5 px-3 h-10 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold disabled:opacity-50 transition-colors"
                data-testid="customer-bulk-delete-btn"
              >
                <Trash2 size={14} /> {bulkDeleting ? 'Siliniyor...' : `Sil (${selectedIds.size})`}
              </button>
            </>
          )}
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
            <div
              key={customer.id}
              className={`relative ${selectionMode ? 'cursor-pointer' : ''}`}
              onClick={selectionMode ? () => toggleSelected(customer.id) : undefined}
            >
              {selectionMode && (
                <div className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds.has(customer.id) ? 'bg-destructive border-destructive' : 'bg-background/80 border-border'}`}>
                  {selectedIds.has(customer.id) && <Check size={14} className="text-destructive-foreground" />}
                </div>
              )}
              <div className={selectionMode && selectedIds.has(customer.id) ? 'ring-2 ring-destructive rounded-xl' : ''}>
                <CustomerCard
                  customer={customer}
                  cars={activeCars}
                  onEdit={selectionMode || !canEdit ? undefined : onEditCustomer}
                  onDelete={selectionMode || !canDelete ? undefined : onDeleteCustomer}
                  onOpenInstallments={selectionMode ? undefined : handleOpenInstallments}
                  onViewDetail={selectionMode ? undefined : (c) => setDetailCustomerId(c.id)}
                  installmentSummary={summaryByCustomer[customer.id]}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vadeli satış drawer (müşteri seçildiğinde modal aç) */}
      {installmentDrawer.open && installmentDrawer.customer && (
        <CustomerInstallmentsDrawer
          customer={installmentDrawer.customer}
          installments={installments.filter(i => i.customer_id === installmentDrawer.customer.id)}
          onClose={() => setInstallmentDrawer({ open: false, customer: null })}
          onAddNew={() => {
            const cust = installmentDrawer.customer;
            setInstallmentDrawer({ open: false, customer: null });
            setInstallmentModal({ open: true, mode: 'create', customerId: cust.id, installmentId: null });
          }}
          onOpenDetail={(id) => {
            setInstallmentDrawer({ open: false, customer: null });
            setInstallmentModal({ open: true, mode: 'detail', customerId: null, installmentId: id });
          }}
        />
      )}

      <InstallmentModal
        isOpen={installmentModal.open}
        onClose={async () => { setInstallmentModal({ open: false, mode: 'create', customerId: null, installmentId: null }); await refreshInstallments(); }}
        mode={installmentModal.mode}
        customerId={installmentModal.customerId}
        installmentId={installmentModal.installmentId}
      />

      {/* ✅ Müşteri Detay Modal */}
      <CustomerDetailModal
        open={!!detailCustomerId}
        customerId={detailCustomerId}
        onClose={() => setDetailCustomerId(null)}
      />
    </div>
  );
};

// ✅ Müşteri'ye ait vadeli satışlar listesi (modal/drawer)
const CustomerInstallmentsDrawer = ({ customer, installments, onClose, onAddNew, onOpenDetail }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Vadeli Satışlar</div>
            <h3 className="text-lg font-heading font-semibold">{customer.name}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
            <Trash2 size={18} className="hidden" />
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {installments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Bu müşteri için henüz vadeli satış yok.
            </div>
          ) : (
            installments.map((i) => (
              <button
                key={i.id}
                onClick={() => onOpenDetail(i.id)}
                className="w-full text-left rounded-lg border border-border bg-muted/20 hover:bg-muted/40 p-3 transition-colors"
                data-testid={`installment-row-${i.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{formatCurrency(i.total_amount)}</div>
                  <span className={`text-xs font-bold ${i.is_settled ? 'text-success' : 'text-destructive'}`}>
                    {i.is_settled ? 'Tamamlandı' : `Kalan: ${formatCurrency(i.remaining_amount)}`}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
                  <span>{formatDate(i.start_date)} · {i.term_count} ay</span>
                  <span>Ödenen: {formatCurrency((i.paid_amount || 0) + (i.down_payment_amount || 0))}</span>
                </div>
                {i.description && <div className="mt-1 text-xs text-muted-foreground truncate">{i.description}</div>}
              </button>
            ))
          )}

          <button
            onClick={onAddNew}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
            data-testid="add-installment-btn"
          >
            <Plus size={18} /> Yeni Vadeli Satış
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomersPage;
