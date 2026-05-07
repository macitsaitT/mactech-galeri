import React, { useState, useEffect, useMemo } from 'react';
import { usersAPI, branchesAPI } from '../services/api';
import { formatPhoneInput, isValidPhone } from '../utils/helpers';
import { UserPlus, Edit, Trash2, Shield, Calculator, ShoppingCart, Building2 } from 'lucide-react';
import { toast } from 'sonner';
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
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', company_name: '', phone: '', role: 'satis', branch_id: '' });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const [usersRes, branchesRes] = await Promise.all([
        usersAPI.getAll(),
        branchesAPI.list().catch(() => ({ data: [] })),
      ]);
      setUsers(usersRes.data);
      setBranches(branchesRes.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', company_name: '', phone: '', role: 'satis', branch_id: '' });
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || user.company_name || '',
      email: user.email || '',
      password: '',
      company_name: user.company_name || '',
      phone: user.phone || '',
      role: user.role || 'satis',
      branch_id: user.branch_id || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email) return;
    // ✅ 11 hane telefon zorunlu
    if (!isValidPhone(formData.phone)) {
      toast.error('Telefon numarası tam 11 haneli olmalıdır (örn: 0532 123 45 67)');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...formData, branch_id: formData.branch_id || null };
      if (editingUser) {
        const updates = { ...payload };
        if (!updates.password) delete updates.password;
        await usersAPI.update(editingUser.id, updates);
      } else {
        if (!formData.password) { toast.error('Şifre gerekli'); setSaving(false); return; }
        await usersAPI.create(payload);
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`${user.email} kullanıcısını silmek istediğinize emin misiniz?`)) return;
    try {
      await usersAPI.delete(user.id);
      // ✅ Optimistic update — listeden hemen çıkar (UI cache'lenmesin)
      setUsers(prev => prev.filter(u => u.id !== user.id));
      // Sonra arka planda gerçek state'i çek
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Silme hatası');
      // Hata durumunda da listeyi yenile (real state'e dön)
      fetchUsers();
    }
  };

  const filteredUsers = useMemo(() => {
    if (!branchFilter) return users;
    if (branchFilter === '__none__') return users.filter(u => !u.branch_id);
    return users.filter(u => u.branch_id === branchFilter);
  }, [users, branchFilter]);

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading font-bold text-xl" data-testid="users-page-title">Kullanıcı Yönetimi</h2>
          <p className="text-sm text-muted-foreground">{filteredUsers.length} / {users.length} kullanıcı</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {branches.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-10 px-3 bg-background border border-border rounded-lg text-sm"
              data-testid="users-branch-filter"
            >
              <option value="">Tüm Şubeler</option>
              <option value="__none__">Şubesiz (Genel)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
            data-testid="add-user-btn"
          >
            <UserPlus size={18} />
            Kullanıcı Ekle
          </button>
        </div>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Bu filtreye uygun kullanıcı yok</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => {
            const rc = roleConfig[user.role] || roleConfig.satis;
            const Icon = rc.icon;
            const branch = branches.find(b => b.id === user.branch_id);
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
                      <p className="font-semibold">{user.name || user.company_name || user.email}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${rc.color}`}>
                    {rc.label}
                  </span>
                  {branch && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30 inline-flex items-center gap-1" data-testid={`user-branch-${user.id}`}>
                      <Building2 size={10} /> {branch.name}
                    </span>
                  )}
                  {!branch && user.branch_id && (
                    <span className="text-[10px] text-muted-foreground">(Şube)</span>
                  )}
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
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value, company_name: e.target.value })}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                data-testid="user-name-input"
                placeholder="Örn: Mehmet Yılmaz"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Telefon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatPhoneInput(e.target.value) })}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                placeholder="0532 XXX XX XX"
                maxLength={14}
                data-testid="user-phone-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Şube (Opsiyonel)</label>
              <select
                value={formData.branch_id}
                onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                data-testid="user-branch-select"
              >
                <option value="">— Genel (Şubesiz) —</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
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
