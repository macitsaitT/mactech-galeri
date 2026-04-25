import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import VehicleCard from '../components/vehicles/VehicleCard';
import ShareCardModal from '../components/modals/ShareCardModal';
import { Search, SlidersHorizontal, Car, Download, CheckCircle } from 'lucide-react';
import { exportAPI } from '../services/api';
import { downloadBlob } from '../utils/helpers';

const InventoryPage = ({ viewType = 'inventory', onEditCar, onViewCar, onExpenses, onDeposit, onSale, onDeleteCar, onCancelSale }) => {
  const { cars } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [exporting, setExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [shareCarId, setShareCarId] = useState(null); // ✅ WhatsApp paylaşım kartı

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

      {/* Results count + Export */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          <span className="font-semibold text-foreground">{filteredCars.length}</span> araç bulundu
        </p>
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
            <VehicleCard
              key={car.id}
              car={car}
              onEdit={onEditCar}
              onDelete={onDeleteCar}
              onView={onViewCar}
              onExpenses={onExpenses}
              onDeposit={onDeposit}
              onSale={onSale}
              onCancelSale={onCancelSale}
              onShare={(c) => setShareCarId(c.id)}
            />
          ))}
        </div>
      )}

      {/* WhatsApp Paylaşım Kartı */}
      <ShareCardModal
        isOpen={!!shareCarId}
        onClose={() => setShareCarId(null)}
        car={cars.find(c => c.id === shareCarId)}
      />
    </div>
  );
};

export default InventoryPage;
