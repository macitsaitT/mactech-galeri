import React from 'react';
import { Building2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Global şube seçici. Header'da görünür.
 * Boş '' → tüm şubelerin birleşik görünümü (varsayılan).
 * Seçili branch_id → yalnızca o şubenin verileri gösterilir.
 */
const BranchSelector = ({ compact = false }) => {
  const { branches, selectedBranchId, setSelectedBranchId, user } = useApp();

  // Sadece admin ve birden fazla şubesi olanlara göster
  if (!user || (user.role !== 'admin' && user.role !== 'muhasebe')) return null;
  if (!branches || branches.length === 0) return null;

  return (
    <div className="flex items-center gap-2" data-testid="branch-selector">
      <Building2 size={14} className="text-muted-foreground shrink-0" />
      <select
        value={selectedBranchId}
        onChange={(e) => setSelectedBranchId(e.target.value)}
        className={`bg-background border border-border rounded-lg text-xs font-semibold ${
          compact ? 'h-8 px-2' : 'h-9 px-3'
        }`}
        data-testid="branch-selector-dropdown"
      >
        <option value="">Tüm Şubeler</option>
        {branches.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  );
};

export default BranchSelector;
