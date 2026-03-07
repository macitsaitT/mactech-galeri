import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatPhoneInput } from '../utils/helpers';
import { Car, Eye, EyeOff, Loader2, Mail, Phone, ArrowLeft, CheckCircle2 } from 'lucide-react';

const LoginPage = () => {
  const { login, register } = useApp();
  const [mode, setMode] = useState('login'); // login | register | verify
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationData, setVerificationData] = useState({ email: '', code: '', expectedCode: '' });
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: 'Aslanbaş Oto',
    phone: ''
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(formData.email, formData.password);
    } catch (err) {
      setError(err.response?.data?.detail || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('E-posta ve şifre zorunludur.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const response = await register(formData.email, formData.password, formData.companyName, formData.phone);
      if (response?.verification_code) {
        setVerificationData({
          email: formData.email,
          code: '',
          expectedCode: response.verification_code
        });
        setMode('verify');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Kayıt başarısız. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');

    if (verificationData.code !== verificationData.expectedCode) {
      setError('Doğrulama kodu hatalı. Lütfen tekrar deneyin.');
      return;
    }

    setLoading(true);
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
      await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationData.email, code: verificationData.code })
      });
      // Already logged in from register, just reload
      window.location.reload();
    } catch (err) {
      setError('Doğrulama başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] gradient-asphalt flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md my-auto py-8">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <img src="/logo-aslanbas.png" alt="Aslanbaş" className="h-28 w-auto object-contain mx-auto" />
        </div>

        {/* Verification Screen */}
        {mode === 'verify' && (
          <div className="bg-card border border-border rounded-2xl p-8 shadow-xl animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Mail size={32} className="text-primary" />
              </div>
              <h2 className="font-heading font-semibold text-xl">E-posta Doğrulama</h2>
              <p className="text-sm text-muted-foreground mt-2">
                <span className="font-medium text-foreground">{verificationData.email}</span> adresine gönderilen 6 haneli doğrulama kodunu girin
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4" data-testid="verify-error">
                {error}
              </div>
            )}

            {/* Show code for demo purposes */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4 text-center">
              <p className="text-xs text-muted-foreground">Doğrulama Kodu:</p>
              <p className="text-2xl font-bold tracking-[0.5em] text-primary" data-testid="verification-code-display">{verificationData.expectedCode}</p>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                maxLength={6}
                value={verificationData.code}
                onChange={(e) => setVerificationData(prev => ({ ...prev, code: e.target.value.replace(/\D/g, '') }))}
                className="w-full h-14 px-4 bg-background border border-border rounded-lg text-center text-2xl tracking-[0.5em] font-bold focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                placeholder="------"
                data-testid="verification-code-input"
              />

              <button
                type="submit"
                disabled={loading || verificationData.code.length !== 6}
                className="w-full h-12 gradient-gold rounded-full font-heading font-bold uppercase tracking-wider text-primary-foreground shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="verify-btn"
              >
                {loading ? (
                  <><Loader2 size={20} className="animate-spin" /><span>Doğrulanıyor...</span></>
                ) : (
                  <><CheckCircle2 size={20} /><span>Doğrula</span></>
                )}
              </button>
            </form>

            <button
              onClick={() => { setMode('login'); setError(''); }}
              className="w-full mt-4 text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
              data-testid="back-to-login-btn"
            >
              <ArrowLeft size={14} /> Giriş ekranına dön
            </button>
          </div>
        )}

        {/* Login / Register Form */}
        {mode !== 'verify' && (
          <div className="bg-card border border-border rounded-2xl p-8 shadow-xl animate-slide-up">
            <h2 className="font-heading font-semibold text-xl text-center mb-6">
              {mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
            </h2>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4" data-testid="login-error">
                {error}
              </div>
            )}

            <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Şirket Adı</label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="w-full h-12 px-4 bg-background border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      placeholder="Şirket adınız"
                      data-testid="company-name-input"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-2">
                      <Phone size={14} /> Telefon Numarası <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhoneInput(e.target.value) })}
                      className="w-full h-12 px-4 bg-background border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      placeholder="0532 XXX XX XX"
                      maxLength={14}
                      required
                      data-testid="phone-input"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-2">
                  <Mail size={14} /> E-posta
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-12 px-4 bg-background border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  placeholder="ornek@email.com"
                  required
                  data-testid="email-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Şifre</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full h-12 px-4 pr-12 bg-background border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    placeholder="••••••••"
                    required
                    data-testid="password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="toggle-password-btn"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {mode === 'register' && (
                  <p className="text-xs text-muted-foreground mt-1">En az 6 karakter</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 gradient-gold rounded-full font-heading font-bold uppercase tracking-wider text-primary-foreground shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="submit-btn"
              >
                {loading ? (
                  <><Loader2 size={20} className="animate-spin" /><span>Bekleyin...</span></>
                ) : (
                  <span>{mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                data-testid="toggle-auth-mode"
              >
                {mode === 'login' ? 'Hesabınız yok mu? Kayıt olun' : 'Hesabınız var mı? Giriş yapın'}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-muted-foreground text-xs mt-8">
          © 2024 Aslanbaş Oto. Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
