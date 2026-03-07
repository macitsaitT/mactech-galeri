import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatPhoneInput } from '../utils/helpers';
import { Calendar, Plus, Clock, Phone, Car, Trash2, Check, X, ChevronLeft, ChevronRight, MessageCircle, BellRing } from 'lucide-react';

const STATUS_CONFIG = {
  'Bekliyor': { bg: 'bg-primary/15', text: 'text-primary', dot: 'bg-primary' },
  'Onaylandı': { bg: 'bg-green-500/15', text: 'text-green-500', dot: 'bg-green-500' },
  'Tamamlandı': { bg: 'bg-blue-500/15', text: 'text-blue-500', dot: 'bg-blue-500' },
  'İptal': { bg: 'bg-red-500/15', text: 'text-red-500', dot: 'bg-red-500' },
};

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const CalendarPage = () => {
  const { appointments, cars, addAppointment, updateAppointment, deleteAppointment } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [formData, setFormData] = useState({
    title: '',
    customer_name: '',
    customer_phone: '',
    car_id: '',
    car_info: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    notes: '',
    status: 'Bekliyor',
    reminder_date: '',
  });

  const activeCars = cars.filter(c => !c.deleted && c.status !== 'Satıldı');

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayApps = appointments.filter(a => a.date === dateStr);
      days.push({ day: d, date: dateStr, appointments: dayApps });
    }
    return days;
  }, [currentMonth, appointments]);

  const selectedDayApps = appointments
    .filter(a => a.date === selectedDate)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const upcomingApps = appointments
    .filter(a => a.date >= new Date().toISOString().split('T')[0] && a.status !== 'İptal' && a.status !== 'Tamamlandı')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
    .slice(0, 5);

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date) return;
    
    const carInfo = formData.car_id 
      ? activeCars.find(c => c.id === formData.car_id)
      : null;
    
    await addAppointment({
      ...formData,
      car_info: carInfo ? `${carInfo.brand} ${carInfo.model} - ${carInfo.plate}` : formData.car_info,
    });
    
    setFormData({
      title: '', customer_name: '', customer_phone: '', car_id: '', car_info: '',
      date: selectedDate, time: '10:00', notes: '', status: 'Bekliyor', reminder_date: '',
    });
    setShowForm(false);
  };

  const changeMonth = (delta) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Randevular</h1>
          <p className="text-sm text-muted-foreground">Test sürüşü ve müşteri randevuları</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormData(prev => ({ ...prev, date: selectedDate })); }}
          className="flex items-center gap-2 px-4 py-2.5 gradient-gold rounded-lg font-medium text-sm text-primary-foreground"
          data-testid="add-appointment-btn"
        >
          <Plus size={18} />
          Randevu Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-muted rounded-lg transition-colors" data-testid="prev-month-btn">
              <ChevronLeft size={20} />
            </button>
            <h3 className="font-heading font-semibold text-lg">
              {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-muted rounded-lg transition-colors" data-testid="next-month-btn">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map((item, idx) => {
              if (!item) return <div key={idx} />;
              const isSelected = item.date === selectedDate;
              const isToday = item.date === today;
              const hasApps = item.appointments.length > 0;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedDate(item.date)}
                  className={`relative p-2 text-sm rounded-lg transition-all text-center min-h-[44px] ${
                    isSelected ? 'bg-primary text-primary-foreground font-bold' :
                    isToday ? 'bg-primary/10 text-primary font-semibold' :
                    'hover:bg-muted'
                  }`}
                  data-testid={`cal-day-${item.date}`}
                >
                  {item.day}
                  {hasApps && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {item.appointments.slice(0, 3).map((a, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[a.status]?.dot || 'bg-primary'}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel - upcoming */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h3 className="font-heading font-semibold">Yaklaşan Randevular</h3>
          </div>
          <div className="p-3 space-y-2">
            {upcomingApps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Yaklaşan randevu yok</p>
            ) : (
              upcomingApps.map(app => (
                <div key={app.id} className={`p-3 rounded-lg ${STATUS_CONFIG[app.status]?.bg || 'bg-muted/50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{app.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CONFIG[app.status]?.text || ''} ${STATUS_CONFIG[app.status]?.bg || ''}`}>{app.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {app.date}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {app.time}</span>
                  </div>
                  {app.customer_name && <p className="text-xs text-muted-foreground mt-1">{app.customer_name}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Selected Day Appointments */}
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-heading font-semibold">
            {selectedDate === today ? 'Bugünkü Randevular' : `${selectedDate} Randevuları`}
          </h3>
          <span className="text-sm text-muted-foreground">{selectedDayApps.length} randevu</span>
        </div>
        <div className="p-3">
          {selectedDayApps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Bu güne ait randevu yok</p>
          ) : (
            <div className="space-y-2">
              {selectedDayApps.map(app => (
                <div key={app.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors" data-testid={`appointment-${app.id}`}>
                  <div className={`w-1 h-12 rounded-full ${STATUS_CONFIG[app.status]?.dot || 'bg-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{app.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CONFIG[app.status]?.text || ''} ${STATUS_CONFIG[app.status]?.bg || ''}`}>{app.status}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Clock size={12} /> {app.time}</span>
                      {app.customer_name && <span>{app.customer_name}</span>}
                      {app.car_info && <span className="flex items-center gap-1"><Car size={12} /> {app.car_info}</span>}
                      {app.reminder_date && <span className="flex items-center gap-1 text-amber-500"><BellRing size={12} /> {app.reminder_date}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {app.customer_phone && (
                      <>
                        <a href={`tel:${app.customer_phone}`} className="p-2 hover:bg-background rounded-lg transition-colors" title="Ara">
                          <Phone size={16} className="text-muted-foreground" />
                        </a>
                        <a href={`sms:${app.customer_phone}`} className="p-2 hover:bg-background rounded-lg transition-colors" title="SMS">
                          <MessageCircle size={16} className="text-muted-foreground" />
                        </a>
                      </>
                    )}
                    {app.status === 'Bekliyor' && (
                      <button onClick={() => updateAppointment(app.id, { status: 'Onaylandı' })} className="p-2 hover:bg-green-500/10 rounded-lg transition-colors" title="Onayla">
                        <Check size={16} className="text-green-500" />
                      </button>
                    )}
                    {app.status === 'Onaylandı' && (
                      <button onClick={() => updateAppointment(app.id, { status: 'Tamamlandı' })} className="p-2 hover:bg-blue-500/10 rounded-lg transition-colors" title="Tamamla">
                        <Check size={16} className="text-blue-500" />
                      </button>
                    )}
                    <button onClick={() => deleteAppointment(app.id)} className="p-2 hover:bg-destructive/10 rounded-lg transition-colors" title="Sil">
                      <Trash2 size={16} className="text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Appointment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-slide-up">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-heading font-semibold text-lg">Yeni Randevu</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-muted rounded-lg" data-testid="close-appointment-form">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Başlık *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                  placeholder="Test sürüşü, görüşme vb."
                  required
                  data-testid="appointment-title-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Tarih *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                    required
                    data-testid="appointment-date-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Saat</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData(p => ({ ...p, time: e.target.value }))}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                    data-testid="appointment-time-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Müşteri Adı</label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData(p => ({ ...p, customer_name: e.target.value }))}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                    placeholder="Ad Soyad"
                    data-testid="appointment-customer-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Telefon</label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData(p => ({ ...p, customer_phone: formatPhoneInput(e.target.value) }))}
                    className="w-full h-11 px-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                    placeholder="0532 XXX XX XX"
                    maxLength={14}
                    data-testid="appointment-phone-input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Araç</label>
                <select
                  value={formData.car_id}
                  onChange={(e) => setFormData(p => ({ ...p, car_id: e.target.value }))}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                  data-testid="appointment-car-select"
                >
                  <option value="">Araç seçin (opsiyonel)</option>
                  {activeCars.map(c => (
                    <option key={c.id} value={c.id}>{c.brand} {c.model} - {c.plate}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Hatırlatma Tarihi</label>
                <input
                  type="date"
                  value={formData.reminder_date}
                  onChange={(e) => setFormData(p => ({ ...p, reminder_date: e.target.value }))}
                  className="w-full h-11 px-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                  data-testid="appointment-reminder-date"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Bu tarihte bildirim gönderilir</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Notlar</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                  className="w-full h-20 p-3 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary resize-none"
                  placeholder="Ek notlar..."
                  data-testid="appointment-notes-input"
                />
              </div>
              <button
                type="submit"
                className="w-full h-11 gradient-gold rounded-lg font-medium text-sm text-primary-foreground"
                data-testid="save-appointment-btn"
              >
                Randevu Kaydet
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
