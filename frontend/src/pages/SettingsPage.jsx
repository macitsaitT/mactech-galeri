import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatPhoneInput } from '../utils/helpers';
import { fileAPI } from '../services/api';
import BranchesManager from '../components/settings/BranchesManager';
import DigestPanel from '../components/settings/DigestPanel';
import {
  Settings,
  User,
  Building,
  Phone,
  MapPin,
  Lock,
  Sun,
  Moon,
  Save,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  ImagePlus,
  X
} from 'lucide-react';

const getLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  if (logoPath.startsWith('http')) return logoPath;
  return fileAPI.getUrl(logoPath);
};

const SettingsPage = () => {
  const { user, updateProfile, deleteAccount, theme, toggleTheme } = useApp();
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    company_name: user?.company_name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    password: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    try {
      const updateData = { ...formData };
      if (!updateData.password) delete updateData.password;
      await updateProfile(updateData);
      setSuccess('Ayarlar kaydedildi!');
      setFormData(prev => ({ ...prev, password: '' }));
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      alert('Sadece resim dosyaları yüklenebilir (PNG, JPG, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Dosya boyutu en fazla 5MB olabilir');
      return;
    }

    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fileAPI.upload(formData);
      const uploadedPath = response.data.path;

      await updateProfile({ logo_url: uploadedPath });
      setSuccess('Logo başarıyla yüklendi!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Logo upload error:', error);
      alert('Logo yüklenirken hata oluştu');
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateProfile({ logo_url: '' });
      setSuccess('Logo kaldırıldı');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Remove logo error:', error);
    }
  };

  const logoUrl = getLogoUrl(user?.logo_url);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-primary/10">
          <Settings size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-2xl">Ayarlar</h1>
          <p className="text-sm text-muted-foreground">Profil ve uygulama ayarları</p>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-success/10 border border-success/20 text-success rounded-lg" data-testid="settings-success-msg">
          {success}
        </div>
      )}

      {/* Theme Toggle */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Tema</h3>
        <div className="flex gap-4">
          <button
            onClick={() => theme !== 'light' && toggleTheme()}
            className={`flex-1 p-4 rounded-lg border-2 transition-all ${
              theme === 'light' ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'
            }`}
            data-testid="light-theme-btn"
          >
            <Sun size={24} className="mx-auto mb-2" />
            <p className="font-medium text-sm">Açık</p>
          </button>
          <button
            onClick={() => theme !== 'dark' && toggleTheme()}
            className={`flex-1 p-4 rounded-lg border-2 transition-all ${
              theme === 'dark' ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'
            }`}
            data-testid="dark-theme-btn"
          >
            <Moon size={24} className="mx-auto mb-2" />
            <p className="font-medium text-sm">Koyu</p>
          </button>
        </div>
      </div>

      {/* Logo Upload */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-1">Şirket Logosu</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Logo, PDF raporlarında ve yazdırma çıktılarında transparent şekilde kullanılır.
        </p>

        <div className="flex items-center gap-5">
          {/* Preview */}
          {logoUrl ? (
            <div className="relative group">
              <div className="w-24 h-24 rounded-xl border-2 border-border overflow-hidden bg-white flex items-center justify-center p-2">
                <img
                  src={logoUrl}
                  alt="Şirket Logosu"
                  className="max-w-full max-h-full object-contain"
                  crossOrigin="anonymous"
                  data-testid="logo-preview"
                />
              </div>
              <button
                onClick={handleRemoveLogo}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid="remove-logo-btn"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
              <ImagePlus size={28} className="text-muted-foreground" />
            </div>
          )}

          {/* Upload Area */}
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleLogoUpload}
              className="hidden"
              data-testid="logo-file-input"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={logoUploading}
              className="px-5 py-2.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              data-testid="upload-logo-btn"
            >
              <ImagePlus size={16} />
              {logoUploading ? 'Yükleniyor...' : logoUrl ? 'Logoyu Değiştir' : 'Logo Yükle'}
            </button>
            <p className="text-[11px] text-muted-foreground mt-2">
              PNG, JPG veya WEBP. Maks 5MB. Transparent PNG önerilir.
            </p>
          </div>
        </div>
      </div>

      {/* Digest Panel */}
      <DigestPanel />

      {/* Profile Form */}
      <BranchesManager />

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold mb-4">Profil Bilgileri</h3>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <User size={16} className="text-muted-foreground" />
            E-posta
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full h-12 px-4 bg-muted border border-border rounded-lg text-muted-foreground cursor-not-allowed"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <Building size={16} className="text-muted-foreground" />
            Şirket Adı
          </label>
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => handleChange('company_name', e.target.value)}
            className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
            placeholder="Şirket adı"
            data-testid="settings-company-input"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <Phone size={16} className="text-muted-foreground" />
            Telefon
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', formatPhoneInput(e.target.value))}
            className="w-full h-12 px-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
            placeholder="0532 XXX XX XX"
            maxLength={14}
            data-testid="settings-phone-input"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <MapPin size={16} className="text-muted-foreground" />
            Adres
          </label>
          <textarea
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className="w-full h-24 p-4 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors resize-none"
            placeholder="Galeri adresi"
            data-testid="settings-address-input"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <Lock size={16} className="text-muted-foreground" />
            Yeni Şifre
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              className="w-full h-12 px-4 pr-12 bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
              placeholder="Değiştirmek için yeni şifre girin"
              data-testid="settings-password-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Boş bırakırsanız şifre değişmez</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="save-settings-btn"
        >
          <Save size={20} />
          {loading ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </form>

      {/* App Info */}
      <div className="text-center text-sm text-muted-foreground">
        <p>MACTech CRM v2.1.0</p>
        <p className="mt-1">&copy; 2024 Tüm hakları saklıdır.</p>
      </div>

      {/* KVKK - Delete Account */}
      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={20} className="text-destructive" />
          <h3 className="font-semibold text-destructive">Hesabımı ve Verilerimi Sil</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          KVKK kapsamında hesabınızı ve tüm ilişkili verilerinizi (araçlar, müşteriler, işlemler) kalıcı olarak silebilirsiniz. Bu işlem geri alınamaz.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors flex items-center gap-2"
            data-testid="show-delete-account-btn"
          >
            <Trash2 size={16} />
            Hesabımı Sil
          </button>
        ) : (
          <div className="space-y-3 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
            <p className="text-sm font-medium text-destructive">
              Onaylamak için aşağıya <strong>"SİL"</strong> yazın:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full h-11 px-3 bg-background border border-destructive/50 rounded-lg text-sm outline-none focus:border-destructive"
              placeholder='SİL'
              data-testid="delete-confirm-input"
            />
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (deleteConfirmText === 'SİL') {
                    try { await deleteAccount(); } catch (e) { console.error('Delete failed:', e); }
                  }
                }}
                disabled={deleteConfirmText !== 'SİL'}
                className="px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-40 transition-colors flex items-center gap-2"
                data-testid="confirm-delete-account-btn"
              >
                <Trash2 size={16} />
                Kalıcı Olarak Sil
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                data-testid="cancel-delete-btn"
              >
                İptal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
