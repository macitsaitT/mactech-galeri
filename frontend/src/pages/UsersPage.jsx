import React, { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import { UserPlus, Edit, Trash2, Shield, Calculator, ShoppingCart, X, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const roleConfig = {
  admin: { label: 'Admin', icon: Shield, color: 'bg-primary/20 text-primary border-primary/30' },
  muhasebe: { label: 'Muhasebe', icon: Calculator, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  satis: { label: 'Satış Elemanı', icon: ShoppingCart, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ email: '', password: '', company_name: '', phone: '', role: 'satis' });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await usersAPI.getAll();
      setUsers(res.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => {
    setEditingUser(null);
    setFormData({ email: '', password: '', company_name: '', phone: '', role: 'satis' });
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email || '',
      password: '',
      company_name: user.company_name || '',
      phone: user.phone || '',
      role: user.role || 'satis',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email) return;
    setSaving(true);
    try {
      if (editingUser) {
        const updates = { ...formData };
        if (!updates.password) delete updates.password;
        await usersAPI.update(editingUser.id, updates);
      } else {
        if (!formData.password) { alert('Şifre gerekli'); setSaving(false); return; }
        await usersAPI.create(formData);
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`${user.email} kullanıcısını silmek istediğinize emin misiniz?`)) return;
    try {
      await usersAPI.delete(user.id);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Silme hatası');
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-xl" data-testid="users-page-title">Kullanıcı Yönetimi</h2>
          <p className="text-sm text-muted-foreground">{users.length} kullanıcı</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
          data-testid="add-user-btn"
        >
          <UserPlus size={18} />
          Kullanıcı Ekle
        </button>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Kullanıcı bulunamadı</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => {
            const rc = roleConfig[user.role] || roleConfig.satis;
            const Icon = rc.icon;
            return (
              <div
                key={user.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-all"
                data-testid={`user-card-${user.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${rc.color}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="font-semibold">{user.company_name || user.email}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${rc.color}`}>
                    {rc.label}
                  </span>
                  {user.phone && <span className="text-xs text-muted-foreground">{user.phone}</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(user)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                    data-testid={`edit-user-${user.id}`}
                  >
                    <Edit size={14} />
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-destructive border border-border rounded-lg hover:bg-destructive/10 transition-colors"
                    data-testid={`delete-user-${user.id}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={24} className="text-primary" />
              {editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                required
                data-testid="user-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {editingUser ? 'Yeni Şifre (boş bırakılırsa değişmez)' : 'Şifre'}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                required={!editingUser}
                data-testid="user-password-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Ad Soyad</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                data-testid="user-name-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Telefon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                data-testid="user-phone-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Yetki</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(roleConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const isActive = formData.role === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: key })}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm font-medium transition-all ${
                        isActive ? `${cfg.color} border-2` : 'border-border hover:bg-muted'
                      }`}
                      data-testid={`role-${key}-btn`}
                    >
                      <Icon size={20} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 sm:px-6 py-3 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors text-sm"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 sm:px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 text-sm"
                data-testid="save-user-btn"
              >
                {saving ? 'Kaydediliyor...' : editingUser ? 'Güncelle' : 'Kullanıcı Ekle'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
