// Browser Push Notification System

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

export const sendLocalNotification = (title, body, tag = 'default') => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body,
    icon: '/logo-aslanbas.png',
    badge: '/logo-aslanbas.png',
    tag,
    vibrate: [200, 100, 200],
    requireInteraction: false
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  // Auto close after 8 seconds
  setTimeout(() => notification.close(), 8000);
};

// Track which notifications have been sent (to avoid duplicates)
const sentNotifications = new Set();

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
    sendLocalNotification(msg.title, msg.body, type);
  }
};

// Start periodic check (every 5 minutes)
let checkInterval = null;

export const startNotificationService = (getAppointments) => {
  // Initial check
  const appointments = getAppointments();
  if (appointments) checkUpcomingAppointments(appointments);

  // Periodic check
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(() => {
    const latest = getAppointments();
    if (latest) checkUpcomingAppointments(latest);
  }, 5 * 60 * 1000); // 5 minutes
};

export const stopNotificationService = () => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
};
