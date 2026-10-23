import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { permissionsAPI, usersAPI } from '../services/api';
import { Shield, Save, RotateCcw, Users, ChevronDown, ChevronRight, Check } from 'lucide-react';

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

const ROLE_LABELS = { muhasebe: 'Muhasebe', satis: 'Satış Danışmanı' };

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

const Toggle = ({ isOn, onChange, testId }) => (
  <button
    onClick={onChange}
    className={`w-10 h-6 rounded-full transition-colors relative ${isOn ? 'bg-green-500' : 'bg-muted'}`}
    data-testid={testId}
  >
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isOn ? 'left-[18px]' : 'left-0.5'}`} />
  </button>
);

const PermissionsPage = () => {
  const { user, setPermissions: setGlobalPermissions, setPermissionsVersion } = useApp();
  const [roleDefaults, setRoleDefaults] = useState(null);
  const [userOverrides, setUserOverrides] = useState({});
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('roles');
  const [expandedUser, setExpandedUser] = useState(null);

  useEffect(() => {
    permissionsAPI.get().then(res => {
      setRoleDefaults(res.data?.role_defaults || res.data?.permissions || DEFAULT_PERMISSIONS);
      setUserOverrides(res.data?.user_overrides || {});
    }).catch(() => setRoleDefaults(DEFAULT_PERMISSIONS));

    usersAPI.getEmployees().then(res => {
      setEmployees((res.data || []).filter(e => e.role !== 'admin'));
    }).catch(() => {});
  }, []);

  if (user?.role !== 'admin') {
    return <div className="text-center py-16 text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  if (!roleDefaults) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const toggleRole = (role, key) => {
    setRoleDefaults(prev => ({ ...prev, [role]: { ...prev[role], [key]: !prev[role][key] } }));
    setSaved(false);
  };

  const toggleUser = (userId, key) => {
    setUserOverrides(prev => {
      const current = prev[userId] || {};
      const emp = employees.find(e => e.id === userId);
      const roleDefault = roleDefaults[emp?.role]?.[key];
      const currentVal = key in current ? current[key] : roleDefault;
      const newVal = !currentVal;
      // If new value matches role default, remove the override
      if (newVal === roleDefault) {
        const updated = { ...current };
        delete updated[key];
        if (Object.keys(updated).length === 0) {
          const newOverrides = { ...prev };
          delete newOverrides[userId];
          return newOverrides;
        }
        return { ...prev, [userId]: updated };
      }
      return { ...prev, [userId]: { ...current, [key]: newVal } };
    });
    setSaved(false);
  };

  const getUserPermValue = (userId, key) => {
    const emp = employees.find(e => e.id === userId);
    if (userOverrides[userId] && key in userOverrides[userId]) return userOverrides[userId][key];
    return roleDefaults[emp?.role]?.[key] || false;
  };

  const isUserOverridden = (userId, key) => {
    return userOverrides[userId] && key in userOverrides[userId];
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await permissionsAPI.update({ role_defaults: roleDefaults, user_overrides: userOverrides });
      setGlobalPermissions({ role_defaults: roleDefaults, user_overrides: userOverrides });
      // ✅ Admin'in kendi tarayıcısında "yetkileriniz güncellendi" toast'u almaması için sürümü bump et
      if (res?.data?.version) setPermissionsVersion(res.data.version);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('Kaydetme hatası');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Tüm yetkileri varsayılana sıfırlamak istediğinize emin misiniz?')) {
      setRoleDefaults(DEFAULT_PERMISSIONS);
      setUserOverrides({});
      setSaved(false);
    }
  };

  const resetUserOverrides = (userId) => {
    setUserOverrides(prev => { const n = { ...prev }; delete n[userId]; return n; });
    setSaved(false);
  };

  return (
    <div className="space-y-5 pb-24 md:pb-6 animate-fade-in" data-testid="permissions-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Shield size={24} className="text-primary" /></div>
          <div>
            <h1 className="font-heading font-bold text-xl">Yetki Yönetimi</h1>
            <p className="text-xs text-muted-foreground">Rol ve kullanıcı bazlı erişim izinleri</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset} className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5" data-testid="reset-permissions-btn">
            <RotateCcw size={14} /><span className="hidden sm:inline">Sıfırla</span>
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50" data-testid="save-permissions-btn">
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'roles' ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}
          data-testid="tab-roles"
        >
          <Shield size={16} /> Rol Varsayılanları
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'users' ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}
          data-testid="tab-users"
        >
          <Users size={16} /> Kullanıcı Bazlı
          {Object.keys(userOverrides).length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-warning text-warning-foreground text-[10px]">{Object.keys(userOverrides).length}</span>
          )}
        </button>
      </div>

      {/* Role Defaults Tab */}
      {activeTab === 'roles' && (
        <>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground">
            <strong className="text-primary">Not:</strong> Bu ayarlar tüm Muhasebe ve Satış Danışmanı kullanıcıları için geçerlidir. Bireysel farklılıklar için "Kullanıcı Bazlı" sekmesini kullanın.
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="permissions-table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-sm font-semibold w-1/2">Yetki</th>
                    <th className="text-center p-4 text-sm font-semibold">Muhasebe</th>
                    <th className="text-center p-4 text-sm font-semibold">Satış Danışmanı</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_GROUPS.map(group => (
                    <React.Fragment key={group.group}>
                      <tr className="bg-muted/20">
                        <td colSpan={3} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary">{group.group}</td>
                      </tr>
                      {group.items.map(item => (
                        <tr key={item.key} className="border-b border-border last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-3 text-sm">{item.label}</td>
                          {['muhasebe', 'satis'].map(role => (
                            <td key={role} className="text-center px-4 py-3">
                              <Toggle isOn={roleDefaults[role]?.[item.key]} onChange={() => toggleRole(role, item.key)} testId={`perm-${role}-${item.key}`} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* User-Based Tab */}
      {activeTab === 'users' && (
        <>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground">
            <strong className="text-primary">Not:</strong> Burada her kullanıcı için rolünün varsayılan yetkilerinden farklı ayarlar yapabilirsiniz. Sarı işaretli yetkiler özelleştirilmiş olanları gösterir.
          </div>
          {employees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Henüz eklenmiş çalışan yok.</p>
              <p className="text-xs">Kullanıcılar sayfasından çalışan ekleyin.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map(emp => {
                const isExpanded = expandedUser === emp.id;
                const overrideCount = userOverrides[emp.id] ? Object.keys(userOverrides[emp.id]).length : 0;
                return (
                  <div key={emp.id} className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`user-perms-${emp.id}`}>
                    <button
                      onClick={() => setExpandedUser(isExpanded ? null : emp.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                      data-testid={`user-expand-${emp.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                          {emp.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-sm">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{ROLE_LABELS[emp.role] || emp.role}</p>
                        </div>
                        {overrideCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-[10px] font-bold">
                            {overrideCount} özel yetki
                          </span>
                        )}
                      </div>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border">
                        {overrideCount > 0 && (
                          <div className="p-3 bg-muted/20 flex justify-end">
                            <button
                              onClick={() => resetUserOverrides(emp.id)}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              <RotateCcw size={12} /> Rol varsayılanına döndür
                            </button>
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <tbody>
                              {PERMISSION_GROUPS.map(group => (
                                <React.Fragment key={group.group}>
                                  <tr className="bg-muted/20">
                                    <td colSpan={2} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary">{group.group}</td>
                                  </tr>
                                  {group.items.map(item => {
                                    const val = getUserPermValue(emp.id, item.key);
                                    const overridden = isUserOverridden(emp.id, item.key);
                                    return (
                                      <tr key={item.key} className={`border-b border-border last:border-0 ${overridden ? 'bg-warning/5' : 'hover:bg-muted/10'}`}>
                                        <td className="px-4 py-2.5 text-sm flex items-center gap-2">
                                          {item.label}
                                          {overridden && <span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" title="Özelleştirilmiş" />}
                                        </td>
                                        <td className="text-right px-4 py-2.5">
                                          <Toggle isOn={val} onChange={() => toggleUser(emp.id, item.key)} testId={`user-perm-${emp.id}-${item.key}`} />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PermissionsPage;
