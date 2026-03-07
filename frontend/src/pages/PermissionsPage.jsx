import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { permissionsAPI } from '../services/api';
import { Shield, Check, X, Save, RotateCcw } from 'lucide-react';

const PERMISSION_GROUPS = [
  {
    group: 'Araçlar',
    items: [
      { key: 'vehicles_view', label: 'Araçları Görme' },
      { key: 'vehicles_add', label: 'Araç Ekleme' },
      { key: 'vehicles_edit', label: 'Araç Düzenleme' },
      { key: 'vehicles_delete', label: 'Araç Silme' },
      { key: 'vehicles_sell', label: 'Araç Satış Yapma' },
      { key: 'vehicles_price_view', label: 'Alış Fiyatını Görme' },
    ]
  },
  {
    group: 'Müşteriler',
    items: [
      { key: 'customers_view', label: 'Müşterileri Görme' },
      { key: 'customers_add', label: 'Müşteri Ekleme' },
      { key: 'customers_edit', label: 'Müşteri Düzenleme' },
      { key: 'customers_delete', label: 'Müşteri Silme' },
    ]
  },
  {
    group: 'Finansal İşlemler',
    items: [
      { key: 'transactions_view', label: 'İşlemleri Görme' },
      { key: 'transactions_add', label: 'İşlem Ekleme' },
      { key: 'transactions_edit', label: 'İşlem Düzenleme' },
      { key: 'transactions_delete', label: 'İşlem Silme' },
    ]
  },
  {
    group: 'Raporlar & Diğer',
    items: [
      { key: 'reports_view', label: 'Raporları Görme' },
      { key: 'dashboard_view', label: 'Dashboard Görme' },
      { key: 'trash_view', label: 'Çöp Kutusunu Görme' },
    ]
  },
  {
    group: 'Randevular',
    items: [
      { key: 'appointments_view', label: 'Randevuları Görme' },
      { key: 'appointments_add', label: 'Randevu Ekleme' },
      { key: 'appointments_edit', label: 'Randevu Düzenleme' },
      { key: 'appointments_delete', label: 'Randevu Silme' },
    ]
  },
];

const ROLES = [
  { key: 'muhasebe', label: 'Muhasebe' },
  { key: 'satis', label: 'Satış Danışmanı' },
];

const DEFAULT_PERMISSIONS = {
  muhasebe: {
    vehicles_view: true, vehicles_add: false, vehicles_edit: false, vehicles_delete: false,
    vehicles_sell: false, vehicles_price_view: true,
    customers_view: true, customers_add: false, customers_edit: false, customers_delete: false,
    transactions_view: true, transactions_add: true, transactions_edit: true, transactions_delete: false,
    reports_view: true,
    appointments_view: true, appointments_add: false, appointments_edit: false, appointments_delete: false,
    dashboard_view: true, trash_view: false,
  },
  satis: {
    vehicles_view: true, vehicles_add: true, vehicles_edit: true, vehicles_delete: false,
    vehicles_sell: true, vehicles_price_view: false,
    customers_view: true, customers_add: true, customers_edit: true, customers_delete: false,
    transactions_view: false, transactions_add: true, transactions_edit: false, transactions_delete: false,
    reports_view: false,
    appointments_view: true, appointments_add: true, appointments_edit: true, appointments_delete: true,
    dashboard_view: true, trash_view: false,
  }
};

const PermissionsPage = () => {
  const { user, setPermissions: setGlobalPermissions } = useApp();
  const [localPerms, setLocalPerms] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    permissionsAPI.get().then(res => {
      setLocalPerms(res.data?.permissions || DEFAULT_PERMISSIONS);
    }).catch(() => setLocalPerms(DEFAULT_PERMISSIONS));
  }, []);

  if (user?.role !== 'admin') {
    return <div className="text-center py-16 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  if (!localPerms) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const toggle = (role, key) => {
    setLocalPerms(prev => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role][key] }
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await permissionsAPI.update(localPerms);
      setGlobalPermissions(localPerms);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert('Kaydetme hatası');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Yetkileri varsayılana sıfırlamak istediğinize emin misiniz?')) {
      setLocalPerms(DEFAULT_PERMISSIONS);
      setSaved(false);
    }
  };

  return (
    <div className="space-y-5 pb-24 md:pb-6 animate-fade-in" data-testid="permissions-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl">Yetki Yönetimi</h1>
            <p className="text-xs text-muted-foreground">Rol bazlı erişim izinlerini düzenleyin</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset} className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5" data-testid="reset-permissions-btn">
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Sıfırla</span>
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50" data-testid="save-permissions-btn">
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Admin note */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground">
        <strong className="text-primary">Not:</strong> Admin rolü her zaman tam yetkiye sahiptir. Burada sadece Muhasebe ve Satış Danışmanı rollerinin yetkilerini düzenleyebilirsiniz.
      </div>

      {/* Permissions Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="permissions-table">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-4 text-sm font-semibold w-1/2">Yetki</th>
                {ROLES.map(role => (
                  <th key={role.key} className="text-center p-4 text-sm font-semibold">{role.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map(group => (
                <React.Fragment key={group.group}>
                  <tr className="bg-muted/20">
                    <td colSpan={3} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary">
                      {group.group}
                    </td>
                  </tr>
                  {group.items.map(item => (
                    <tr key={item.key} className="border-b border-border last:border-0 hover:bg-muted/10">
                      <td className="px-4 py-3 text-sm">{item.label}</td>
                      {ROLES.map(role => {
                        const isOn = localPerms[role.key]?.[item.key] === true;
                        return (
                          <td key={role.key} className="text-center px-4 py-3">
                            <button
                              onClick={() => toggle(role.key, item.key)}
                              className={`w-10 h-6 rounded-full transition-colors relative ${isOn ? 'bg-green-500' : 'bg-muted'}`}
                              data-testid={`perm-${role.key}-${item.key}`}
                            >
                              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isOn ? 'left-[18px]' : 'left-0.5'}`} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PermissionsPage;
