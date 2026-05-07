import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Car,
  Users,
  Wallet,
  Settings,
  Package,
  ShoppingCart,
  Trash2,
  LogOut,
  Sun,
  Moon,
  X,
  FileText,
  Calendar,
  UserCog,
  Shield,
  CalendarClock,
  Wrench,
  Calculator,
  ChevronDown,
  Briefcase,
  PiggyBank,
  SlidersHorizontal,
  Activity,
  Trophy,
  Search as SearchIcon,
  AlertTriangle,
  Hourglass,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';

// Kategori bazlı menü yapısı — her grup collapsible bir panel
const menuGroups = [
  {
    id: 'operations',
    label: 'Operasyon',
    icon: Briefcase,
    items: [
      { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard, roles: ['admin', 'muhasebe', 'satis'], perm: 'dashboard_view' },
      { id: 'inventory', label: 'Stok Araçlar', icon: Car, roles: ['admin', 'satis'], perm: 'vehicles_view' },
      { id: 'consignment', label: 'Konsinye Araçlar', icon: Package, roles: ['admin', 'satis'], perm: 'vehicles_view' },
      { id: 'sold', label: 'Satılan Araçlar', icon: ShoppingCart, roles: ['admin', 'satis'], perm: 'vehicles_view' },
      { id: 'customers', label: 'Müşteriler', icon: Users, roles: ['admin', 'satis', 'muhasebe'], perm: 'customers_view' },
      { id: 'calendar', label: 'Randevular', icon: Calendar, roles: ['admin', 'satis'], perm: 'appointments_view' },
      { id: 'inspection', label: 'Muayene Takibi', icon: Wrench, roles: ['admin', 'satis'], perm: 'vehicles_view' },
      { id: 'wanted-cars', label: 'Aranan Araçlar', icon: SearchIcon, roles: ['admin', 'satis'] },
      { id: 'stock-aging', label: 'Stok Yaşlanma', icon: Hourglass, roles: ['admin', 'muhasebe'] },
    ],
  },
  {
    id: 'finance',
    label: 'Finans',
    icon: PiggyBank,
    items: [
      { id: 'finance', label: 'Gelir & Gider', icon: Wallet, roles: ['admin', 'muhasebe'], perm: 'transactions_view' },
      { id: 'receivables', label: 'Alacaklar', icon: AlertTriangle, roles: ['admin', 'muhasebe'] },
      { id: 'reports', label: 'Raporlar', icon: FileText, roles: ['admin', 'muhasebe'], perm: 'reports_view' },
      { id: 'calculations', label: 'Hesaplama Araçları', icon: Calculator, roles: ['admin', 'muhasebe', 'satis'], perm: 'dashboard_view' },
      { id: 'year-end', label: 'Yıl Sonu Devri', icon: CalendarClock, roles: ['admin'] },
    ],
  },
  {
    id: 'management',
    label: 'Yönetim',
    icon: SlidersHorizontal,
    items: [
      { id: 'permissions', label: 'Yetki Yönetimi', icon: Shield, roles: ['admin'] },
      { id: 'users', label: 'Kullanıcılar', icon: UserCog, roles: ['admin'] },
      { id: 'employee-performance', label: 'Personel Performansı', icon: Trophy, roles: ['admin', 'muhasebe'] },
      { id: 'activity-logs', label: 'İşlem Geçmişi', icon: Activity, roles: ['admin', 'muhasebe'] },
      { id: 'trash', label: 'Çöp Kutusu', icon: Trash2, roles: ['admin'], perm: 'trash_view' },
    ],
  },
];

const STORAGE_KEY = 'mactech_sidebar_collapsed_groups';

const Sidebar = ({ activeView, setActiveView, isOpen, onClose, onOpenReport }) => {
  const { user, logout, theme, toggleTheme, hasPermission } = useApp();
  const userRole = user?.role || 'admin';

  // Default: tüm gruplar açık. Kullanıcı tercihi localStorage'da saklanır.
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedGroups));
    } catch { /* ignore */ }
  }, [collapsedGroups]);

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isItemVisible = (item) => {
    if (userRole === 'admin') return item.roles.includes('admin');
    if (!item.roles.includes(userRole)) return false;
    if (item.perm) return hasPermission(item.perm);
    return true;
  };

  const handleNavClick = (itemId) => {
    if (itemId === 'reports') {
      onOpenReport?.();
    } else {
      setActiveView(itemId);
    }
    onClose();
  };

  // Aktif item'a sahip grubu otomatik aç (UX: aktif sekme görünmez kalmasın)
  const groupOfActive = menuGroups.find(g => g.items.some(it => it.id === activeView));

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}

      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#0a0a0a] flex flex-col transform transition-transform duration-300 ease-out border-r border-white/5',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        data-testid="sidebar"
      >
        {/* Header */}
        <div className="h-24 flex items-center justify-between px-4 border-b border-white/10">
          <img src="/logo-mactech.png" alt="MACTech" className="h-14 w-auto object-contain" />
          <button
            onClick={onClose}
            className="md:hidden p-2 text-white/70 hover:text-white transition-colors"
            data-testid="sidebar-close-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Actions — yetkilere göre gösteriliyor */}
        <div className="p-3 grid grid-cols-2 gap-2">
          {(userRole === 'admin' || hasPermission('vehicles_add')) && (
            <button
              onClick={() => { setActiveView('add-car'); onClose(); }}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold"
              data-testid="quick-add-car"
            >
              <span className="text-xl mb-1">+</span>
              <span className="text-[10px] uppercase tracking-wider">Araç Girişi</span>
            </button>
          )}
          <button
            onClick={() => { setActiveView('promo-card'); onClose(); }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors font-semibold"
            data-testid="quick-promo-card"
          >
            <FileText size={20} className="mb-1" />
            <span className="text-[10px] uppercase tracking-wider">Tanıtım Kartı</span>
          </button>
          {(userRole === 'admin' || hasPermission('transactions_add')) && (
            <button
              onClick={() => { setActiveView('add-expense'); onClose(); }}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-semibold"
              data-testid="quick-add-expense"
            >
              <Wallet size={20} className="mb-1" />
              <span className="text-[10px] uppercase tracking-wider">Araç Gideri</span>
            </button>
          )}
          {(userRole === 'admin' || hasPermission('transactions_add')) && (
            <button
              onClick={() => { setActiveView('add-transaction'); onClose(); }}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors font-semibold"
              data-testid="quick-add-transaction"
            >
              <FileText size={20} className="mb-1" />
              <span className="text-[10px] uppercase tracking-wider">Genel İşlem</span>
            </button>
          )}
        </div>

        {/* Kategori bazlı Navigation */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto" data-testid="sidebar-nav">
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter(isItemVisible);
            if (visibleItems.length === 0) return null;

            // Aktif sekmeyi barındıran grup daima açık başlasın
            const isCollapsed = groupOfActive?.id === group.id ? false : !!collapsedGroups[group.id];
            const GroupIcon = group.icon;

            return (
              <div key={group.id} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  data-testid={`sidebar-group-${group.id}`}
                >
                  <span className="flex items-center gap-2">
                    <GroupIcon size={14} className="opacity-80" />
                    <span className="text-[11px] uppercase tracking-[0.15em] font-bold">
                      {group.label}
                    </span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn('transition-transform duration-200', isCollapsed ? '-rotate-90' : 'rotate-0')}
                  />
                </button>
                <ul
                  className={cn(
                    'overflow-hidden transition-all duration-200',
                    isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100 mt-0.5'
                  )}
                >
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => handleNavClick(item.id)}
                          className={cn(
                            'w-full flex items-center gap-3 pl-6 pr-3 py-2.5 rounded-lg transition-all duration-150 text-left text-sm relative',
                            isActive
                              ? 'bg-primary/25 text-white font-semibold shadow-inner shadow-primary/10'
                              : 'text-white/75 hover:text-white hover:bg-white/10 font-medium'
                          )}
                          data-testid={`nav-${item.id}`}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r" aria-hidden />
                          )}
                          <Icon size={18} className={isActive ? 'text-primary' : 'text-white/80'} />
                          <span>{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <button
            onClick={() => { setActiveView('settings'); onClose(); }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium',
              activeView === 'settings'
                ? 'bg-primary/25 text-white font-semibold'
                : 'text-white/75 hover:text-white hover:bg-white/10'
            )}
            data-testid="nav-settings"
          >
            <Settings size={18} />
            <span>Ayarlar</span>
          </button>

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
            data-testid="theme-toggle"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}</span>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-all text-sm font-medium"
            data-testid="logout-btn"
          >
            <LogOut size={18} />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
