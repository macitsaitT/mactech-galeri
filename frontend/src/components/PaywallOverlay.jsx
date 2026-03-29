// MACTech Multi-Tenant SaaS - Paywall Overlay Component
// /frontend/src/components/PaywallOverlay.jsx

import React, { useState, useEffect } from 'react';
import { Lock, Shield, CreditCard, Check, X, ExternalLink } from 'lucide-react';
import { setPaywallCallback, subscriptionAPI } from '../services/apiMultiTenant';

// ==================== PAYWALL CONTEXT ====================

const PaywallContext = React.createContext({
  isVisible: false,
  paywallData: null,
  showPaywall: () => {},
  hidePaywall: () => {},
});

export const usePaywall = () => React.useContext(PaywallContext);

// ==================== PAYWALL PROVIDER ====================

export const PaywallProvider = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [paywallData, setPaywallData] = useState(null);

  useEffect(() => {
    // API interceptor'dan gelen paywall tetiklemelerini dinle
    setPaywallCallback((data) => {
      setPaywallData(data);
      setIsVisible(data.isVisible);
    });
  }, []);

  const showPaywall = (data) => {
    setPaywallData(data);
    setIsVisible(true);
  };

  const hidePaywall = () => {
    setIsVisible(false);
    // Data'yı temizleme - kullanıcı yeniden deneyebilir
  };

  return (
    <PaywallContext.Provider value={{ isVisible, paywallData, showPaywall, hidePaywall }}>
      {children}
      {isVisible && <PaywallOverlay data={paywallData} onClose={hidePaywall} />}
    </PaywallContext.Provider>
  );
};

// ==================== PAYWALL OVERLAY COMPONENT ====================

const PaywallOverlay = ({ data, onClose }) => {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const {
    sector,
    status,
    message,
    trialEndedAt,
    dataPreserved,
    plans = [],
    checkoutUrl,
  } = data || {};

  const sectorNames = {
    gallery: 'Galeri',
    realestate: 'Emlak',
    logistics: 'Lojistik',
    accounting: 'Muhasebe',
  };

  const sectorName = sectorNames[sector] || sector;

  // Plan seçimi ve ödeme başlatma
  const handleSelectPlan = async (plan) => {
    setSelectedPlan(plan.id);
    setLoading(true);
    setError(null);

    try {
      const response = await subscriptionAPI.checkout({
        sector_id: sector,
        plan_id: plan.id,
      });

      // iyzico checkout form'u aç
      if (response.data.checkout_form_content) {
        // Yeni pencerede aç
        const checkoutWindow = window.open('', 'iyzico_checkout', 'width=500,height=650,scrollbars=yes');
        if (checkoutWindow) {
          checkoutWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Ödeme - MACTech</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
                .container { max-width: 400px; margin: 0 auto; }
              </style>
            </head>
            <body>
              <div class="container">
                ${response.data.checkout_form_content}
              </div>
            </body>
            </html>
          `);
          checkoutWindow.document.close();
        }
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Ödeme başlatılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  // Overlay dışına tıklama - kapatma
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      // Overlay'e tıklandı ama kapatmıyoruz
      // Kullanıcı mutlaka plan seçmeli
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      {/* Blur Background */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-6 border-b border-border">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-foreground">
            {status === 'trial' || status === 'expired' 
              ? 'Deneme Süreniz Doldu' 
              : 'Abonelik Gerekli'}
          </h2>
          <p className="text-center text-muted-foreground mt-2">
            {sectorName} modülü için
          </p>
        </div>

        {/* Data Safe Banner */}
        {dataPreserved && (
          <div className="bg-green-500/10 border-y border-green-500/20 px-6 py-3">
            <div className="flex items-center gap-2 justify-center">
              <Shield className="w-5 h-5 text-green-500" />
              <span className="text-green-600 dark:text-green-400 font-medium text-sm">
                Verileriniz güvende! Hiçbir veri silinmedi.
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {/* Message */}
          <p className="text-center text-muted-foreground mb-6">
            {message || 'Devam etmek için bir abonelik planı seçin.'}
          </p>

          {/* Trial End Date */}
          {trialEndedAt && (
            <div className="text-center text-sm text-muted-foreground mb-6">
              Deneme süresi: <span className="font-medium">{new Date(trialEndedAt).toLocaleDateString('tr-TR')}</span> tarihinde sona erdi
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              <p className="text-red-500 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Plans */}
          <div className="space-y-3 mb-6">
            {plans.length > 0 ? (
              plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => !loading && handleSelectPlan(plan)}
                  className={`
                    relative border rounded-xl p-4 cursor-pointer transition-all
                    ${loading && selectedPlan === plan.id
                      ? 'border-primary bg-primary/5 opacity-75'
                      : 'border-border hover:border-primary hover:bg-primary/5'
                    }
                    ${plan.is_popular ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                  `}
                >
                  {/* Popular Badge */}
                  {plan.is_popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      Popüler
                    </div>
                  )}

                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-foreground">{plan.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {plan.features && Object.entries(plan.features).slice(0, 3).map(([key, value]) => (
                          <span key={key} className="inline-flex items-center text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            <Check className="w-3 h-3 mr-1 text-green-500" />
                            {key}: {typeof value === 'boolean' ? (value ? 'Var' : 'Yok') : value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        ₺{plan.price_monthly}
                      </p>
                      <p className="text-xs text-muted-foreground">/ay</p>
                      {plan.price_yearly && (
                        <p className="text-xs text-muted-foreground mt-1">
                          veya ₺{plan.price_yearly}/yıl
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Loading Indicator */}
                  {loading && selectedPlan === plan.id && (
                    <div className="absolute inset-0 bg-card/80 rounded-xl flex items-center justify-center">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-muted-foreground">Yönlendiriliyor...</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Mevcut plan bulunamadı.</p>
                <a
                  href={checkoutUrl || '/pricing'}
                  className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
                >
                  Fiyatlandırma sayfasına git
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>

          {/* iyzico Badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <CreditCard className="w-4 h-4" />
            <span>Güvenli ödeme: iyzico altyapısı ile</span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted/50 px-6 py-4 border-t border-border">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              Daha Sonra
            </button>
            <a
              href="/contact"
              className="text-sm text-primary hover:underline"
            >
              Yardım mı lazım?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== PAYWALL TRIGGER BUTTON (for testing) ====================

export const PaywallTriggerButton = ({ sector = 'gallery' }) => {
  const { showPaywall } = usePaywall();

  const handleTrigger = () => {
    showPaywall({
      isVisible: true,
      sector,
      status: 'expired',
      message: 'Deneme süreniz sona erdi. Verileriniz güvende, erişmek için paket yenileyin.',
      trialEndedAt: new Date().toISOString(),
      dataPreserved: true,
      plans: [
        {
          id: 'starter',
          name: 'Starter',
          price_monthly: 99,
          price_yearly: 990,
          features: { max_items: 50, reports: false, multi_user: false },
        },
        {
          id: 'pro',
          name: 'Pro',
          price_monthly: 299,
          price_yearly: 2990,
          is_popular: true,
          features: { max_items: 500, reports: true, multi_user: true },
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          price_monthly: 799,
          price_yearly: 7990,
          features: { max_items: -1, reports: true, multi_user: true, api_access: true },
        },
      ],
      checkoutUrl: '/subscribe/gallery',
    });
  };

  return (
    <button
      onClick={handleTrigger}
      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
    >
      Test Paywall
    </button>
  );
};

export default PaywallOverlay;
