import { FileText, Building2, Tag, Key, Car, TrendingUp, Wallet, CalendarDays, Plus } from 'lucide-react';
import { fileAPI } from '../../../services/api';

// ✅ Rapor tipleri ve başlıkları — ReportModal.jsx'ten ayrıldı (refactor)
export const reportTypes = [
  { id: 'general', label: 'Genel', icon: FileText },
  { id: 'business', label: 'İşletme', icon: Building2 },
  { id: 'profitloss', label: 'Kâr/Zarar', icon: TrendingUp },
  { id: 'capital', label: 'Sermaye', icon: Wallet },
  { id: 'yearend', label: 'Yıl Sonu', icon: CalendarDays },
  { id: 'deposit', label: 'Kapora', icon: Key },
  { id: 'car', label: 'Araç', icon: Car },
  { id: 'expenses', label: 'Araç Masrafları', icon: Plus },
];

export const reportTitles = {
  general: 'Finansal Durum Raporu',
  business: 'İşletme Raporu',
  profitloss: 'Stok Araç Kâr/Zarar Raporu',
  capital: 'Sermaye / Kasa Hareket Raporu',
  yearend: 'Yıl Sonu Kapanış Raporu',
  deposit: 'Kapora Raporu',
  car: 'Araç Raporu',
  expenses: 'Araç Masrafları Raporu',
};

export const getLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  if (logoPath.startsWith('http')) return logoPath;
  return fileAPI.getUrl(logoPath);
};
