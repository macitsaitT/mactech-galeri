import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import { authAPI } from '../services/api';
import { formatPhoneInput } from '../utils/helpers';
import { Eye, EyeOff, Loader2, Mail, ArrowLeft, CheckCircle2, QrCode, Smartphone, Monitor, RefreshCw } from 'lucide-react';

const LoginPage = () => {
  const { login, register, setUser, setToken } = useApp();
  const [mode, setMode] = useState('login'); // login, verify, qr
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationData, setVerificationData] = useState({ email: '', code: '', expectedCode: '' });

  // QR Login State
  const [qrSessionId, setQrSessionId] = useState(null);
  const [qrStatus, setQrStatus] = useState('pending'); // pending, scanned, approved, expired
  const qrPollInterval = useRef(null);

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // QR Kod oluştur
  const generateQRSession = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await authAPI.generateQRSession();
      setQrSessionId(res.data.session_id);
      setQrStatus('pending');
      setMode('qr');
      
      // Polling başlat
      startQRPolling(res.data.session_id);
    } catch (err) {
      setError('QR kod oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  // QR Status Polling
  const startQRPolling = (sessionId) => {
    // Önceki polling'i temizle
    if (qrPollInterval.current) {
      clearInterval(qrPollInterval.current);
    }

    qrPollInterval.current = setInterval(async () => {
      try {
        const res = await authAPI.checkQRStatus(sessionId);
        setQrStatus(res.data.status);

        if (res.data.status === 'approved' && res.data.token) {
          // Giriş başarılı!
          clearInterval(qrPollInterval.current);
          localStorage.setItem('crm_token', res.data.token);
          localStorage.setItem('crm_user', JSON.stringify(res.data.user));
          window.location.reload();
        }
      } catch (err) {
        if (err.response?.status === 410 || err.response?.status === 404) {
          // Session expired
          setQrStatus('expired');
          clearInterval(qrPollInterval.current);
        }
      }
    }, 2000); // Her 2 saniyede kontrol et
  };

  // Component unmount olduğunda polling'i temizle
  useEffect(() => {
    return () => {
      if (qrPollInterval.current) {
        clearInterval(qrPollInterval.current);
      }
    };
  }, []);

  // QR'ı yenile
  const refreshQR = () => {
    if (qrPollInterval.current) {
      clearInterval(qrPollInterval.current);
    }
    generateQRSession();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(formData.email, formData.password);
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      
      // no_subscription hatası - kullanıcı mactech.tr'de var ama trial yok
      if (errorDetail && typeof errorDetail === 'object' && errorDetail.reason === 'no_subscription') {
        setError('MacTech.tr\'de hesabınız var ama Galeri trial\'ı başlatılmamış. İlk giriş için otomatik trial başlatılacak, lütfen tekrar deneyin.');
      } else if (typeof errorDetail === 'string') {
        setError(errorDetail);
      } else {
        setError('Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    window.open('https://mactech.tr/forgot-password', '_blank');
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.verifyEmail({
        email: verificationData.email,
        code: verificationData.code
      });
      const loginRes = await authAPI.login({
        email: verificationData.email,
        password: formData.password
      });
      localStorage.setItem('crm_token', loginRes.data.token);
      localStorage.setItem('crm_user', JSON.stringify(loginRes.data.user));
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.detail || 'Doğrulama başarısız.');
    } finally {
      setLoading(false);
    }
  };

  // QR kod URL'i - mobil uygulama bu URL'yi açacak
  const qrCodeValue = qrSessionId ? `mactech://qr-login?session_id=${qrSessionId}` : '';
  // Web için alternatif URL
  const webQrUrl = qrSessionId ? `${window.location.origin}/qr-login?session_id=${qrSessionId}` : '';

  return (
    <div className="min-h-screen gradient-asphalt flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <img src="/logo-mactech.png" alt="MACTech" className="h-36 w-auto object-contain mx-auto" />
        </div>

        {/* Verification Form */}
        {mode === 'verify' && (
          <div className="bg-card border border-border rounded-2xl p-8 shadow-xl animate-slide-up">
            <div className="text-center mb-6">
              <CheckCircle2 size={48} className="text-success mx-auto mb-3" />
              <h2 className="font-heading font-semibold text-xl">E-posta Doğrulama</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {verificationData.email} adresine gönderilen kodu girin
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            {/* Demo: Kodu göster */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Demo için doğrulama kodunuz:</p>
              <p className="font-mono text-2xl font-bold text-primary tracking-widest">{verificationData.expectedCode}</p>
            </div>

            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Doğrulama Kodu</label>
                <input
                  type="text"
                  value={verificationData.code}
                  onChange={(e) => setVerificationData({ ...verificationData, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="w-full h-14 px-4 bg-background border border-border rounded-lg text-center text-2xl tracking-[0.5em] font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  placeholder="000000"
                  maxLength={6}
                  required
                  data-testid="verification-code-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading || verificationData.code.length !== 6}
                className="w-full h-12 gradient-gold rounded-full font-heading font-bold uppercase tracking-wider text-primary-foreground shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="verify-submit-btn"
              >
                {loading ? <><Loader2 size={20} className="animate-spin" /> Doğrulanıyor...</> : 'Doğrula ve Giriş Yap'}
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

        {/* QR Code Login */}
        {mode === 'qr' && (
          <div className="bg-card border border-border rounded-2xl p-8 shadow-xl animate-slide-up">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Monitor className="text-primary" size={28} />
                <ArrowLeft className="text-muted-foreground" size={20} />
                <Smartphone className="text-primary" size={28} />
              </div>
              <h2 className="font-heading font-semibold text-xl">QR Kod ile Giriş</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Telefonunuzdaki MACTech uygulaması ile QR kodu okutun
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            <div className="flex justify-center mb-6">
              {qrStatus === 'expired' ? (
                <div className="w-64 h-64 bg-muted/50 rounded-2xl flex flex-col items-center justify-center">
                  <p className="text-muted-foreground mb-4">QR kod süresi doldu</p>
                  <button
                    onClick={refreshQR}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <RefreshCw size={18} />
                    Yenile
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="bg-white p-4 rounded-2xl shadow-lg">
                    <QRCodeSVG
                      value={webQrUrl}
                      size={220}
                      level="H"
                      includeMargin={false}
                      imageSettings={{
                        src: "/logo-mactech.png",
                        x: undefined,
                        y: undefined,
                        height: 40,
                        width: 40,
                        excavate: true,
                      }}
                    />
                  </div>
                  
                  {/* Status Overlay */}
                  {qrStatus === 'scanned' && (
                    <div className="absolute inset-0 bg-card/90 rounded-2xl flex flex-col items-center justify-center">
                      <Loader2 size={40} className="text-primary animate-spin mb-3" />
                      <p className="font-medium text-primary">QR Kod Okundu!</p>
                      <p className="text-sm text-muted-foreground">Telefonunuzda onaylayın...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status Indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`w-2 h-2 rounded-full ${
                qrStatus === 'pending' ? 'bg-yellow-500 animate-pulse' :
                qrStatus === 'scanned' ? 'bg-blue-500 animate-pulse' :
                qrStatus === 'approved' ? 'bg-green-500' :
                'bg-red-500'
              }`} />
              <span className="text-sm text-muted-foreground">
                {qrStatus === 'pending' && 'QR kod bekleniyor...'}
                {qrStatus === 'scanned' && 'Telefonda onay bekleniyor...'}
                {qrStatus === 'approved' && 'Giriş başarılı!'}
                {qrStatus === 'expired' && 'Süre doldu'}
              </span>
            </div>

            {/* Instructions */}
            <div className="bg-muted/30 rounded-xl p-4 mb-6">
              <h4 className="font-medium text-sm mb-2">Nasıl çalışır?</h4>
              <ol className="text-sm text-muted-foreground space-y-1">
                <li>1. Telefonunuzda MACTech uygulamasını açın</li>
                <li>2. Hesabınıza giriş yapın (yapılmadıysa)</li>
                <li>3. QR kod okutma seçeneğine tıklayın</li>
                <li>4. Bu ekrandaki QR kodu okutun</li>
                <li>5. Telefonda girişi onaylayın</li>
              </ol>
            </div>

            <button
              onClick={() => { setMode('login'); setError(''); if(qrPollInterval.current) clearInterval(qrPollInterval.current); }}
              className="w-full text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
            >
              <ArrowLeft size={14} /> E-posta ile giriş yap
            </button>
          </div>
        )}

        {/* Login Form */}
        {mode !== 'verify' && mode !== 'qr' && (
          <div className="bg-card border border-border rounded-2xl p-8 shadow-xl animate-slide-up">
            <h2 className="font-heading font-semibold text-xl text-center mb-6">
              Giriş Yap
            </h2>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4" data-testid="login-error">
                {error}
              </div>
            )}

            {/* QR Login Button */}
            <button
              onClick={generateQRSession}
              disabled={loading}
              className="w-full h-12 bg-primary/10 text-primary border border-primary/30 rounded-full font-medium flex items-center justify-center gap-3 hover:bg-primary/20 transition-all active:scale-95 mb-4"
              data-testid="qr-login-btn"
            >
              <QrCode size={20} />
              QR Kod ile Giriş Yap
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-xs text-muted-foreground">veya</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">

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
                  <span>Giriş Yap</span>
                )}
              </button>
            </form>

            {/* Şifremi Unuttum */}
            <div className="mt-6 text-center">
              <button
                onClick={handleForgotPassword}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                data-testid="forgot-password-btn"
              >
                Şifremi Unuttum
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-muted-foreground text-xs mt-8">
          © 2024 MACTech. Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
