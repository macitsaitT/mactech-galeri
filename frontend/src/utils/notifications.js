// Browser Push Notification System

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

export const sendLocalNotification = async (title, body, tag = 'default') => {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // ✅ Önce Service Worker üzerinden dene (mobil Chrome zorunlu).
    // Bu yapılmazsa "Failed to construct 'Notification': Illegal constructor" hatası satışı/işlemi patlatıyordu.
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, {
            body,
            icon: '/assets/images/ti-cari-logo-mark.png',
            badge: '/assets/images/ti-cari-logo-mark.png',
            tag,
            vibrate: [200, 100, 200],
            requireInteraction: false,
          });
          return;
        }
      } catch (_) { /* SW yoksa aşağıdaki direct constructor fallback'e düş */ }
    }

    // Direct constructor (sadece desktop'ta çalışır)
    try {
      const notification = new Notification(title, {
        body,
        icon: '/assets/images/ti-cari-logo-mark.png',
        badge: '/assets/images/ti-cari-logo-mark.png',
        tag,
        requireInteraction: false,
      });
      notification.onclick = () => { window.focus(); notification.close(); };
      setTimeout(() => notification.close(), 8000);
    } catch (_) {
      // Mobil cihazlarda direct constructor "Illegal constructor" verir; sessizce yut.
    }
  } catch (_) {
    // Bildirim hatası asla ana akışı (satış vb.) bozmamalı.
  }
};

// Track which notifications have been sent (to avoid duplicates)
const sentNotifications = new Set();

export const checkInspectionDates = (cars) => {
  if (!cars || cars.length === 0) return;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  cars.forEach(car => {
    if (car.deleted || !car.inspection_date) return;

    try {
      const inspectionDate = new Date(car.inspection_date);
      const notificationDays = car.inspection_notification_days || 30;
      
      // Kaç gün kaldı
      const daysUntil = Math.ceil((inspectionDate - today) / (1000 * 60 * 60 * 24));
      
      // Bildirim günü geldi mi?
      if (daysUntil > 0 && daysUntil <= notificationDays) {
        const notifKey = `inspection-${car.id}-${todayStr}`;
        if (sentNotifications.has(notifKey)) return;
        
        sentNotifications.add(notifKey);
        sendLocalNotification(
          '🔧 Muayene Tarihi Yaklaşıyor',
          `${car.brand} ${car.model} (${car.plate || ''}) - ${daysUntil} gün kaldı`,
          `inspection-${car.id}`
        );
      } else if (daysUntil === 0) {
        // Bugün muayene günü
        const notifKey = `inspection-today-${car.id}-${todayStr}`;
        if (!sentNotifications.has(notifKey)) {
          sentNotifications.add(notifKey);
          sendLocalNotification(
            '🚨 Muayene Tarihi Bugün!',
            `${car.brand} ${car.model} (${car.plate || ''}) muayene tarihi bugün`,
            `inspection-today-${car.id}`
          );
        }
      } else if (daysUntil < 0) {
        // Muayene tarihi geçmiş
        const notifKey = `inspection-overdue-${car.id}-${todayStr}`;
        if (!sentNotifications.has(notifKey)) {
          sentNotifications.add(notifKey);
          sendLocalNotification(
            '⚠️ Muayene Tarihi Geçmiş!',
            `${car.brand} ${car.model} (${car.plate || ''}) muayene ${Math.abs(daysUntil)} gün önce geçmiş`,
            `inspection-overdue-${car.id}`
          );
        }
      }
    } catch (e) {
      console.error('Inspection date check error:', e);
    }
  });
};

export const checkUpcomingAppointments = (appointments) => {
  if (!appointments || appointments.length === 0) return;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

  appointments.forEach(app => {
    if (app.status === 'İptal' || app.status === 'Tamamlandı' || app.deleted) return;

    const notifKey = `${app.id}-${todayStr}`;
    if (sentNotifications.has(notifKey)) return;

    // Reminder date is today
    if (app.reminder_date === todayStr) {
      sentNotifications.add(notifKey);
      sendLocalNotification(
        'Randevu Hatırlatma',
        `${app.title}${app.customer_name ? ' - ' + app.customer_name : ''} | ${app.date} ${app.time || ''}`,
        `reminder-${app.id}`
      );
    }

    // Appointment is today
    if (app.date === todayStr) {
      sentNotifications.add(notifKey);
      sendLocalNotification(
        'Bugün Randevunuz Var',
        `${app.title}${app.customer_name ? ' - ' + app.customer_name : ''} | Saat: ${app.time || 'Belirtilmemiş'}`,
        `today-${app.id}`
      );
    }

    // Appointment is tomorrow
    if (app.date === tomorrowStr) {
      const tomorrowKey = `${app.id}-tomorrow-${todayStr}`;
      if (!sentNotifications.has(tomorrowKey)) {
        sentNotifications.add(tomorrowKey);
        sendLocalNotification(
          'Yarın Randevunuz Var',
          `${app.title}${app.customer_name ? ' - ' + app.customer_name : ''} | ${app.time || ''}`,
          `tomorrow-${app.id}`
        );
      }
    }
  });
};

// Event-based notifications
export const notifyEvent = (type, data) => {
  try {
    const messages = {
      car_sold: {
        title: 'Araç Satıldı',
        body: `${data?.brand || ''} ${data?.model || ''} ${data?.plate ? '(' + data.plate + ')' : ''} satış tamamlandı.`
      },
      deposit_received: {
        title: 'Kapora Alındı',
        body: `${data?.brand || ''} ${data?.model || ''} için kapora kaydedildi.`
      },
      new_appointment: {
        title: 'Yeni Randevu',
        body: `${data?.title || 'Randevu'} - ${data?.date || ''} ${data?.time || ''}`
      },
      new_customer: {
        title: 'Yeni Müşteri',
        body: `${data?.name || 'Müşteri'} kaydedildi.`
      }
    };

    const msg = messages[type];
    if (msg) {
      // sendLocalNotification artık async — Promise rejection'ı sessizce yut
      Promise.resolve(sendLocalNotification(msg.title, msg.body, type)).catch(() => {});
    }
  } catch (_) {
    // Bildirim hatası asla ana akışı bozmamalı
  }
};

// Start periodic check (every 5 minutes)
let checkInterval = null;

export const startNotificationService = (getAppointments, getCars) => {
  // Initial check
  const appointments = getAppointments();
  if (appointments) checkUpcomingAppointments(appointments);
  
  const cars = getCars ? getCars() : null;
  if (cars) checkInspectionDates(cars);

  // Periodic check
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(() => {
    const latest = getAppointments();
    if (latest) checkUpcomingAppointments(latest);
    
    const latestCars = getCars ? getCars() : null;
    if (latestCars) checkInspectionDates(latestCars);
  }, 5 * 60 * 1000); // 5 minutes
};

export const stopNotificationService = () => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
};
