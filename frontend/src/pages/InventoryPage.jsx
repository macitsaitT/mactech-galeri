import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import VehicleCard from '../components/vehicles/VehicleCard';
import ShareCardModal from '../components/modals/ShareCardModal';
import MultiShareModal from '../components/modals/MultiShareModal';
import { Search, SlidersHorizontal, Car, Download, CheckCircle, Share2, X as XIcon, Check } from 'lucide-react';
import { exportAPI } from '../services/api';
import { downloadBlob, formatCurrency } from '../utils/helpers';
import { generateConsignmentPDF } from '../utils/consignmentPdf';

const InventoryPage = ({ viewType = 'inventory', onEditCar, onViewCar, onExpenses, onDeposit, onSale, onDeleteCar, onCancelSale }) => {
  const { cars, customers, user } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [exporting, setExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [shareCarId, setShareCarId] = useState(null);
  // ✅ Çoklu seçim modu (Stok Kataloğu paylaşımı için)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [multiShareOpen, setMultiShareOpen] = useState(false);

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConsignmentPdf = (car) => {
    const owner = customers.find(c => c.id === car.owner_id) || { name: car.owner_name || '' };
    generateConsignmentPDF({
      car,
      owner,
      gallery: { name: user?.company_name || 'MACTech Galeri', phone: user?.phone, address: user?.address },
      commission: car.commission_rate || 0,
      agreedPrice: car.sale_price || car.purchase_price,
      notes: car.notes,
    });
  };

  // Filter cars based on view type
  const filteredCars = useMemo(() => {
    let result = cars.filter(c => !c.deleted);

    // Filter by view type
    switch (viewType) {
      case 'inventory':
        result = result.filter(c => c.ownership === 'stock' && c.status !== 'Satıldı');
        break;
      case 'consignment':
        result = result.filter(c => c.ownership === 'consignment' && c.status !== 'Satıldı');
        break;
      case 'sold':
        result = result.filter(c => c.status === 'Satıldı');
        break;
      default:
        break;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.brand?.toLowerCase().includes(query) ||
        c.model?.toLowerCase().includes(query) ||
        c.plate?.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'price_high':
        result.sort((a, b) => (b.sale_price || 0) - (a.sale_price || 0));
        break;
      case 'price_low':
        result.sort((a, b) => (a.sale_price || 0) - (b.sale_price || 0));
        break;
      default:
        break;
    }

    return result;
  }, [cars, viewType, searchQuery, sortBy]);

  const getTitle = () => {
    switch (viewType) {
      case 'inventory': return 'Stok Araçlar';
      case 'consignment': return 'Konsinye Araçlar';
      case 'sold': return 'Satılan Araçlar';
      default: return 'Araçlar';
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-fade-in">
      {/* Header with Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Marka, model veya plaka ara..."
            className="w-full h-12 pl-12 pr-4 bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            data-testid="search-input"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={20} className="text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-12 px-4 bg-card border border-border rounded-lg focus:border-primary outline-none text-sm"
            data-testid="sort-select"
          >
            <option value="newest">En Yeni</option>
            <option value="oldest">En Eski</option>
            <option value="price_high">Fiyat (Yüksek)</option>
            <option value="price_low">Fiyat (Düşük)</option>
          </select>
        </div>
      </div>

      {/* Results count + Toplu Paylaş + Export */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          <span className="font-semibold text-foreground">{filteredCars.length}</span> araç bulundu
          {selectionMode && selectedIds.size > 0 && (
            <span className="ml-2 text-primary font-semibold">· {selectedIds.size} seçildi</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {viewType === 'inventory' && !selectionMode && (
            <button
              onClick={() => setSelectionMode(true)}
              className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors"
              data-testid="toggle-multi-select-btn"
            >
              <Share2 size={15} /> Toplu Paylaş
            </button>
          )}
          {selectionMode && (
            <>
              <button
                onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
                className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-border text-muted-foreground text-sm hover:bg-muted transition-colors"
              >
                <XIcon size={15} /> İptal
              </button>
              <button
                onClick={() => setMultiShareOpen(true)}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-colors"
                data-testid="multi-share-open-btn"
              >
                <Check size={15} /> Paylaş ({selectedIds.size})
              </button>
            </>
          )}
          <button
          onClick={async () => {
            setExporting(true);
            setDownloadSuccess(false);
            try {
              const res = await exportAPI.cars();
              downloadBlob(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'araclar.docx');
              setDownloadSuccess(true);
              setTimeout(() => setDownloadSuccess(false), 4000);
            } catch (e) {
              console.error(e);
              alert('Word indirme hatası: ' + (e.message || 'Bilinmeyen hata'));
            } finally {
              setExporting(false);
            }
          }}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          data-testid="export-cars-btn"
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
      {filteredCars.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Car size={32} className="text-muted-foreground" />
          </div>
          <h3 className="font-heading font-semibold text-lg mb-2">Araç Bulunamadı</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {searchQuery 
              ? 'Arama kriterlerinize uygun araç bulunamadı.' 
              : 'Henüz bu kategoride araç eklenmemiş.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCars.map((car) => (
            <div key={car.id} className={`relative ${selectionMode ? 'cursor-pointer' : ''}`} onClick={selectionMode ? () => toggleSelected(car.id) : undefined}>
              {selectionMode && (
                <div className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds.has(car.id) ? 'bg-primary border-primary' : 'bg-background/80 border-border'}`}>
                  {selectedIds.has(car.id) && <Check size={14} className="text-primary-foreground" />}
                </div>
              )}
              <div className={selectionMode && selectedIds.has(car.id) ? 'ring-2 ring-primary rounded-xl' : ''}>
                <VehicleCard
                  car={car}
                  onEdit={selectionMode ? undefined : onEditCar}
                  onDelete={selectionMode ? undefined : onDeleteCar}
                  onView={selectionMode ? undefined : onViewCar}
                  onExpenses={selectionMode ? undefined : onExpenses}
                  onDeposit={selectionMode ? undefined : onDeposit}
                  onSale={selectionMode ? undefined : onSale}
                  onCancelSale={selectionMode ? undefined : onCancelSale}
                  onShare={selectionMode ? undefined : (c) => setShareCarId(c.id)}
                  onConsignmentPdf={selectionMode ? undefined : handleConsignmentPdf}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* WhatsApp Paylaşım Kartı */}
      <ShareCardModal
        isOpen={!!shareCarId}
        onClose={() => setShareCarId(null)}
        car={cars.find(c => c.id === shareCarId)}
      />

      {/* Çoklu (Stok Kataloğu) Paylaşım */}
      <MultiShareModal
        isOpen={multiShareOpen}
        onClose={() => { setMultiShareOpen(false); }}
        onShared={() => { setMultiShareOpen(false); setSelectionMode(false); setSelectedIds(new Set()); }}
        cars={filteredCars.filter(c => selectedIds.has(c.id))}
      />
    </div>
  );
};

export default InventoryPage;
