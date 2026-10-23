/**
 * Frontend kategori sınıflandırma — backend services/expense_classifier.py ile birebir uyumlu.
 *
 * Single source of truth: backend tarafında karar verilir. Burası sadece
 * raporların ve modalların runtime sınıflandırma yapması için duplicate edildi.
 * Yeni kategori eklenirse iki tarafta da güncellenmeli.
 */

export const VEHICLE_COST_CATEGORIES = new Set([
  'Araç Alımı',
  'Araç Sahibine Ödeme',
  'Ekspertiz',
  'Noter',
  'Çekici',
  'Taşıma/Çekici',
  'Nakliye',
  'Bakım',
  'Bakım/Onarım',
  'Detaylı Yıkama',
  'Hazırlık',
  'Plaka',
  'Boyacı',
  'Kaporta',
  'Lastik',
  'Yedek Parça',
]);

export const OPERATING_CATEGORIES = new Set([
  'Personel Maaşı',
  'Maaş',
  'SGK',
  'Kira',
  'Ofis Gideri',
  'Elektrik/Su/Doğalgaz',
  'İnternet/Telefon',
  'Sigorta',
  'Vergi',
  'Reklam/Pazarlama',
  'Reklam',
  'Muhasebe',
  'Temizlik',
  'Kırtasiye',
  'Yemek/İkram',
  'Ulaşım',
  'Diğer Gider',
  'Diğer',
]);

export const NEUTRAL_CATEGORIES = new Set([
  'Kapora İadesi',
  'Çalışan Payı',
]);

/**
 * Bir gider tx'inin sınıfını döndür.
 * @returns {'vehicle_cost' | 'operating' | 'neutral'}
 */
export function classifyExpense(category, carId = null) {
  const cat = (category || '').trim();
  if (VEHICLE_COST_CATEGORIES.has(cat)) return 'vehicle_cost';
  if (OPERATING_CATEGORIES.has(cat)) return 'operating';
  if (NEUTRAL_CATEGORIES.has(cat)) return 'neutral';
  if (carId) return 'vehicle_cost';
  return 'operating';
}

export function isOperatingExpense(tx) {
  if (!tx || tx.type !== 'expense') return false;
  return classifyExpense(tx.category, tx.car_id) === 'operating';
}

export function isVehicleCost(tx) {
  if (!tx || tx.type !== 'expense') return false;
  return classifyExpense(tx.category, tx.car_id) === 'vehicle_cost';
}
