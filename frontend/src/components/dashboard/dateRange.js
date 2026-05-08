// ✅ Dashboard date range presetleri — Dashboard.jsx'ten ayrıldı (refactor)

export const presets = [
  { id: 'week', label: 'Bu Hafta' },
  { id: 'month', label: 'Bu Ay' },
  { id: '3months', label: '3 Ay' },
  { id: '6months', label: '6 Ay' },
  { id: 'year', label: 'Bu Yıl' },
  { id: 'all', label: 'Tümü' },
];

export const getDateRange = (preset) => {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start;
  switch (preset) {
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0]; break;
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; break;
    }
    case '3months': {
      const d = new Date(now); d.setMonth(d.getMonth() - 3);
      start = d.toISOString().split('T')[0]; break;
    }
    case '6months': {
      const d = new Date(now); d.setMonth(d.getMonth() - 6);
      start = d.toISOString().split('T')[0]; break;
    }
    case 'year': {
      start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]; break;
    }
    case 'all': start = '2020-01-01'; break;
    default: start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }
  return { start, end };
};
