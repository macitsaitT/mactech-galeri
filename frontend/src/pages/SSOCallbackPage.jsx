import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

/**
 * SSO Callback Sayfası
 * 
 * MACTech ana platformundan yönlendirilen kullanıcıları işler.
 * URL: /sso-callback?sso_token=xxx
 * 
 * Akış:
 * 1. URL'den sso_token parametresini al
 * 2. Backend'e POST /api/auth/sso-login ile gönder
 * 3. Backend mactech.tr'den token'ı doğrular
 * 4. Başarılıysa JWT token alır ve dashboard'a yönlendirir
 */
const SSOCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleSSOCallback = async () => {
      const ssoToken = searchParams.get('sso_token');
      
      if (!ssoToken) {
        setStatus('error');
        setErrorMessage('SSO token bulunamadı. Lütfen ana siteden tekrar giriş yapın.');
        return;
      }

      try {
        // Backend'e SSO token'ı gönder
        const response = await authAPI.ssoLogin(ssoToken);
        
        if (response.data.token && response.data.user) {
          // Token ve kullanıcı bilgilerini kaydet
          localStorage.setItem('crm_token', response.data.token);
          localStorage.setItem('crm_user', JSON.stringify(response.data.user));
          
          // Access info varsa kaydet
          if (response.data.access_info) {
            localStorage.setItem('crm_access_info', JSON.stringify(response.data.access_info));
          }
          
          setStatus('success');
          
          // 1.5 saniye sonra dashboard'a yönlendir
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } else {
          throw new Error('Geçersiz yanıt');
        }
      } catch (error) {
        console.error('SSO login error:', error);
        setStatus('error');
        
        // Erişim engeli kontrolü (403 hatası)
        if (error.response?.status === 403) {
          const errorDetail = error.response.data.detail;
          
          if (errorDetail?.action === 'show_trial_expired') {
            setErrorMessage('⏰ Deneme süreniz doldu. Pro plana geçerek devam edin!');
            // Websiteye yönlendir
            setTimeout(() => {
              window.location.href = errorDetail.redirect_url || 'https://www.mactech.tr/pro';
            }, 3000);
          } else if (errorDetail?.action === 'show_payment_required') {
            setErrorMessage('💳 Abonelik ödemeniz bekleniyor. Lütfen ödeme yapın.');
            setTimeout(() => {
              window.location.href = errorDetail.redirect_url || 'https://www.mactech.tr/odeme';
            }, 3000);
          } else if (errorDetail?.action === 'show_start_trial') {
            setErrorMessage('🚀 14 günlük ücretsiz deneme başlatın veya Pro plana geçin!');
            setTimeout(() => {
              window.location.href = errorDetail.redirect_url || 'https://www.mactech.tr/uygulamalar/galeri';
            }, 3000);
          } else {
            setErrorMessage(errorDetail?.message || 'Erişim reddedildi.');
            setTimeout(() => {
              window.location.href = errorDetail?.redirect_url || 'https://www.mactech.tr';
            }, 3000);
          }
        } else {
          setErrorMessage(
            error.response?.data?.detail || 
            error.message || 
            'SSO girişi başarısız. Lütfen tekrar deneyin.'
          );
        }
      }
    };

    handleSSOCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen gradient-asphalt flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-8 shadow-xl max-w-md w-full text-center">
        {/* Logo */}
        <img src="/logo-mactech.png" alt="MACTech" className="h-20 w-auto object-contain mx-auto mb-6" />
        
        {status === 'loading' && (
          <>
            <Loader2 size={48} className="animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Giriş Yapılıyor...</h2>
            <p className="text-muted-foreground">
              MACTech hesabınız doğrulanıyor, lütfen bekleyin.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={48} className="text-success mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-success mb-2">Giriş Başarılı!</h2>
            <p className="text-muted-foreground">
              Yönlendiriliyorsunuz...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} className="text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-destructive mb-2">Giriş Başarısız</h2>
            <p className="text-muted-foreground mb-6">
              {errorMessage}
            </p>
            <div className="space-y-3">
              <a
                href="https://mactech.tr/login"
                className="block w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Ana Siteye Dön
              </a>
              <button
                onClick={() => navigate('/login')}
                className="block w-full py-3 px-4 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
              >
                Normal Giriş Yap
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SSOCallbackPage;
