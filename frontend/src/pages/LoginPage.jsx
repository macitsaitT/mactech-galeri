import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { authAPI } from '../services/api';
import { formatPhoneInput } from '../utils/helpers';
import { Car, Eye, EyeOff, Loader2, Mail, Phone, ArrowLeft, CheckCircle2 } from 'lucide-react';

const LoginPage = () => {
  const { login, register, setUser, setToken } = useApp();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationData, setVerificationData] = useState({ email: '', code: '', expectedCode: '' });
  const hasProcessedOAuth = useRef(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: 'Aslanbaş Oto',
    phone: ''
  });

  // Handle Google OAuth callback
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('session_id=') && !hasProcessedOAuth.current) {
      hasProcessedOAuth.current = true;
      const sessionId = hash.split('session_id=')[1]?.split('&')[0];
      if (sessionId) {
        handleGoogleCallback(sessionId);
      }
    }
  }, []);

  const handleGoogleCallback = async (sessionId) => {
    setGoogleLoading(true);
    setError('');
    try {
      const res = await authAPI.googleAuth(sessionId);
      const { token, user } = res.data;
      localStorage.setItem('crm_token', token);
      localStorage.setItem('crm_user', JSON.stringify(user));
      // Clear the hash from URL
      window.history.replaceState(null, '', window.location.pathname);
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.detail || 'Google ile giriş başarısız.');
      window.history.replaceState(null, '', window.location.pathname);
    } finally {
      setGoogleLoading(false);
    }
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + window.location.pathname;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

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
    if (formData.password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
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
      window.location.reload();
    } catch (err) {
      setError('Doğrulama başarısız.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while processing Google OAuth
  if (googleLoading) {
    return (
      <div className="min-h-[100dvh] gradient-asphalt flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 size={48} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Google ile giriş yapılıyor...</p>
        </div>
      </div>
    );
  }

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

            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              className="w-full h-12 bg-white text-gray-800 border border-gray-300 rounded-full font-medium flex items-center justify-center gap-3 hover:bg-gray-50 transition-all active:scale-95 mb-4"
              data-testid="google-login-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google ile {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-xs text-muted-foreground">veya</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>

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
                  <p className="text-xs text-muted-foreground mt-1">En az 8 karakter</p>
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
