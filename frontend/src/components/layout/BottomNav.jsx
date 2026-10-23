import React from 'react';
import { LayoutDashboard, Car, Users, Wallet } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useApp } from '../../context/AppContext';

const allNavItems = [
  { id: 'dashboard', label: 'Genel', icon: LayoutDashboard, roles: ['admin', 'muhasebe', 'satis'] },
  { id: 'inventory', label: 'Araçlar', icon: Car, roles: ['admin', 'satis'] },
  { id: 'customers', label: 'Müşteri', icon: Users, roles: ['admin', 'satis', 'muhasebe'] },
  { id: 'finance', label: 'Finans', icon: Wallet, roles: ['admin', 'muhasebe'] },
];

const BottomNav = ({ activeView, setActiveView }) => {
  const { user } = useApp();
  const userRole = user?.role || 'admin';
  const navItems = allNavItems.filter(item => item.roles.includes(userRole));
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#0a0a0a] border-t border-border safe-area-bottom"
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id || 
            (item.id === 'inventory' && ['inventory', 'consignment', 'sold'].includes(activeView));

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={`bottom-nav-${item.id}`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={cn(
                "text-[10px] truncate",
                isActive ? "font-bold" : "font-medium"
              )}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
