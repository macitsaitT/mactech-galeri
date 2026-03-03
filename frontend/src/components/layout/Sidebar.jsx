import React from 'react';
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
  Calendar
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';

const menuItems = [
  { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
  { id: 'inventory', label: 'Stok Araçlar', icon: Car },
  { id: 'consignment', label: 'Konsinye Araçlar', icon: Package },
  { id: 'sold', label: 'Satılan Araçlar', icon: ShoppingCart },
  { id: 'finance', label: 'Gelir & Gider', icon: Wallet },
  { id: 'reports', label: 'Raporlar', icon: FileText },
  { id: 'customers', label: 'Müşteriler', icon: Users },
  { id: 'calendar', label: 'Randevular', icon: Calendar },
  { id: 'trash', label: 'Çöp Kutusu', icon: Trash2 },
];

const Sidebar = ({ activeView, setActiveView, isOpen, onClose, onOpenReport }) => {
  const { user, logout, theme, toggleTheme } = useApp();

  const handleNavClick = (itemId) => {
    if (itemId === 'reports') {
      onOpenReport?.();
    } else {
      setActiveView(itemId);
    }
    onClose();
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#0f0f0f] flex flex-col transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        data-testid="sidebar"
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          <img src="/logo-aslanbas.png" alt="Aslanbaş" className="h-12 w-auto object-contain" />
          <button 
            onClick={onClose}
            className="md:hidden p-2 text-white/50 hover:text-white transition-colors"
            data-testid="sidebar-close-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Actions - Top */}
        <div className="p-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => { setActiveView('add-car'); onClose(); }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            data-testid="quick-add-car"
          >
            <span className="text-xl mb-1">+</span>
            <span className="text-[10px] font-medium uppercase">Araç Girişi</span>
          </button>
          <button
            onClick={() => { setActiveView('promo-card'); onClose(); }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
            data-testid="quick-promo-card"
          >
            <FileText size={20} className="mb-1" />
            <span className="text-[10px] font-medium uppercase">Tanıtım Kartı</span>
          </button>
          <button
            onClick={() => { setActiveView('add-expense'); onClose(); }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            data-testid="quick-add-expense"
          >
            <Wallet size={20} className="mb-1" />
            <span className="text-[10px] font-medium uppercase">Gider</span>
          </button>
          <button
            onClick={() => { setActiveView('add-transaction'); onClose(); }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
            data-testid="quick-add-transaction"
          >
            <FileText size={20} className="mb-1" />
            <span className="text-[10px] font-medium uppercase">İşlem</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto">
          <ul className="space-y-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      "text-left text-sm",
                      isActive
                        ? "bg-primary/20 text-primary font-medium"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                    data-testid={`nav-${item.id}`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 space-y-1">
          {/* Settings */}
          <button
            onClick={() => {
              setActiveView('settings');
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm"
            data-testid="nav-settings"
          >
            <Settings size={18} />
            <span>Ayarlar</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm"
            data-testid="theme-toggle"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}</span>
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-all text-sm"
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
