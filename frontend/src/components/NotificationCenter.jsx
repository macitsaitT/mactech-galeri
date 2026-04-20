import React, { useState, useEffect } from 'react';
import { Bell, X, Calendar, Download } from 'lucide-react';
import { notificationsAPI } from '../services/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Bildirimleri yükle
  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationsAPI.getNotifications();
      const notifs = res.data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Bildirimler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  // Component mount olduğunda ve her 60 saniyede bir kontrol et
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000); // 60 saniye
    return () => clearInterval(interval);
  }, []);

  // Bildirimi okundu işaretle
  const markAsRead = async (notificationId) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Bildirim işaretlenemedi:', error);
    }
  };

  // Takvim dosyası indir
  const downloadCalendarEvent = async (notification) => {
    try {
      const res = await notificationsAPI.generateICS(
        notification.car_id,
        notification.notification_type
      );
      
      // .ics dosyası oluştur ve indir
      const blob = new Blob([res.data.ics_content], { type: 'text/calendar' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Takvim dosyası indirilemedi:', error);
      alert('Takvim dosyası oluşturulamadı.');
    }
  };

  return (
    <>
      {/* Bildirim Simgesi */}
      <button
        onClick={() => {
          setIsOpen(true);
          loadNotifications();
        }}
        className="relative p-2 hover:bg-muted rounded-lg transition-colors"
        data-testid="notification-bell"
      >
        <Bell size={20} className="text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Bildirim Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <Bell size={20} className="text-primary" />
              Bildirimler
              {unreadCount > 0 && (
                <span className="ml-auto text-xs bg-destructive/20 text-destructive px-2 py-1 rounded-full">
                  {unreadCount} yeni
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Yükleniyor...
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell size={48} className="mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Henüz bildiriminiz yok</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-lg border transition-all ${
                      notif.is_read
                        ? 'bg-background border-border'
                        : 'bg-primary/5 border-primary/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium whitespace-pre-line">
                          {notif.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notif.created_at).toLocaleString('tr-TR')}
                        </p>
                      </div>
                      {!notif.is_read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                          title="Okundu işaretle"
                        >
                          <X size={16} className="text-muted-foreground" />
                        </button>
                      )}
                    </div>

                    {/* Takvime Ekle Butonu */}
                    <button
                      onClick={() => downloadCalendarEvent(notif)}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors"
                    >
                      <Calendar size={16} />
                      Takvime Ekle (.ics)
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationCenter;
