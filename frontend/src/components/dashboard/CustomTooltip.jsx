import React from 'react';
import { formatCurrency } from '../../utils/helpers';

// ✅ Recharts için ortak tooltip — Dashboard.jsx'ten ayrıldı
export const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' && entry.value >= 1000 ? formatCurrency(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};

export default CustomTooltip;
