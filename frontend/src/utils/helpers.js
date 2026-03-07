// Format number with thousand separators (Turkish format)
export const formatNumber = (num) => {
  if (num === null || num === undefined || num === '') return '';
  const number = typeof num === 'string' ? parseFloat(num.replace(/[^\d.-]/g, '')) : num;
  if (isNaN(number)) return '';
  return new Intl.NumberFormat('tr-TR').format(number);
};

// Format currency
export const formatCurrency = (num) => {
  if (num === null || num === undefined || num === '') return '₺0';
  const number = typeof num === 'string' ? parseFloat(num.replace(/[^\d.-]/g, '')) : num;
  if (isNaN(number)) return '₺0';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number);
};

// Parse formatted number back to number
export const parseNumber = (str) => {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
};

// Format input as user types
export const formatNumberInput = (value) => {
  if (!value) return '';
  const cleaned = String(value).replace(/[^\d]/g, '');
  return formatNumber(cleaned);
};

// Format date to Turkish locale
export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Format date with time
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Get relative time
export const getRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Bugün';
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
};

// Format plate number
export const formatPlate = (plate) => {
  if (!plate) return '';
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, ' ').trim();
};

// Calculate profit for a car
export const calculateCarProfit = (car, transactions) => {
  if (!car || car.status !== 'Satıldı') return null;
  
  const carTransactions = transactions.filter(t => t.car_id === car.id && !t.deleted);
  
  const income = carTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const expenses = carTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  return income - expenses;
};

// Get status color
export const getStatusColor = (status) => {
  switch (status) {
    case 'Stokta':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Kapora Alındı':
      return 'bg-warning/20 text-warning border-warning/30';
    case 'Satıldı':
      return 'bg-success/20 text-success border-success/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

// Get ownership badge
export const getOwnershipBadge = (ownership) => {
  switch (ownership) {
    case 'stock':
      return { label: 'Stok', class: 'bg-primary/20 text-primary border-primary/30' };
    case 'consignment':
      return { label: 'Konsinye', class: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
    default:
      return { label: 'Stok', class: 'bg-primary/20 text-primary border-primary/30' };
  }
};

// Debounce function
export const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// Generate unique ID
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Format phone input as 0XXX XXX XX XX (11 digits)
export const formatPhoneInput = (value) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  if (digits.length <= 9) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
};

// Parse phone - strip formatting for storage
export const parsePhone = (value) => {
  if (!value) return '';
  return value.replace(/\D/g, '');
};

// Validate phone number
export const isValidPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 11;
};

// Validate plate number
export const isValidPlate = (plate) => {
  const cleaned = plate.replace(/\s/g, '').toUpperCase();
  return /^[0-9]{2}[A-Z]{1,3}[0-9]{1,4}$/.test(cleaned);
};
