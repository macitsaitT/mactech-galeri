import React, { useState, useEffect, useRef } from 'react';
import { Menu, Clock, Calendar, X } from 'lucide-react';
import NotificationCenter from '../NotificationCenter';
import BranchSelector from './BranchSelector';

const Header = ({ title, onMenuClick, appointments = [] }) => {
  const [now, setNow] = useState(new Date());
  const [showNotifs, setShowNotifs] = useState(false);
  const panelRef = useRef(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowNotifs(false);
      }
    };
    if (showNotifs) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifs]);

  const todayStr = now.toISOString().split('T')[0];

  // Upcoming reminders: appointments with reminder_date === today OR appointments happening today
  const notifications = appointments
    .filter(a => {
      if (a.status === 'İptal' || a.status === 'Tamamlandı') return false;
      if (a.reminder_date === todayStr) return true;
      if (a.date === todayStr) return true;
      if (a.date > todayStr && a.date <= new Date(now.getTime() + 3 * 86400000).toISOString().split('T')[0]) return true;
      return false;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
    .slice(0, 10);

  const unreadCount = notifications.length;

  const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dayName = now.toLocaleDateString('tr-TR', { weekday: 'long' });

  return (
    <header
      className="h-20 flex items-center justify-between px-4 md:px-6 border-b border-border bg-card/50 glass sticky top-0 z-30"
      data-testid="header"
    >
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
          data-testid="menu-toggle-btn"
        >
          <Menu size={24} />
        </button>
        <h1 className="font-heading font-bold text-xl md:text-2xl tracking-tight uppercase text-foreground">
          {title}
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* ✅ Global şube seçici */}
        <div className="hidden sm:block">
          <BranchSelector compact />
        </div>

        {/* Live Clock */}
        <div className="hidden md:flex items-center gap-3 mr-2 border-r border-border pr-4" data-testid="live-clock">
          <div className="text-right leading-tight">
            <p className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground">{timeStr.slice(0, 5)}</p>
            <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">{dateStr} {dayName}</p>
          </div>
        </div>

        {/* Bildirim Merkezi (Yeni Sistem) */}
        <NotificationCenter />

        {/* Randevu Bildirimleri (Eski Sistem - Kalsın) */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50 relative"
            data-testid="notifications-btn"
            title="Randevu Bildirimleri"
          >
            <Calendar size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifs && (
            <div className="absolute right-0 top-12 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-slide-up" data-testid="notifications-panel">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm">Bildirimler</h3>
                <button onClick={() => setShowNotifs(false)} className="p-1 hover:bg-muted rounded">
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Bildirim bulunmuyor
                  </div>
                ) : (
                  notifications.map((app) => {
                    const isReminder = app.reminder_date === todayStr;
                    const isToday = app.date === todayStr;
                    return (
                      <div
                        key={app.id}
                        className="px-3 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                        data-testid={`notif-${app.id}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${isReminder ? 'bg-amber-500' : isToday ? 'bg-primary' : 'bg-blue-400'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{app.title}</p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <Calendar size={10} /> {app.date}
                              </span>
                              {app.time && (
                                <span className="flex items-center gap-1">
                                  <Clock size={10} /> {app.time}
                                </span>
                              )}
                            </div>
                            {app.customer_name && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{app.customer_name}</p>
                            )}
                            {isReminder && (
                              <span className="inline-block mt-1 text-[10px] font-semibold bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded">Hatırlatma</span>
                            )}
                            {isToday && !isReminder && (
                              <span className="inline-block mt-1 text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded">Bugün</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
