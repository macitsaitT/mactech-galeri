// MACTech Multi-Tenant SaaS - Trial Warning Banner
// /frontend/src/components/TrialWarningBanner.jsx

import React from 'react';
import { AlertTriangle, Clock, X, CreditCard } from 'lucide-react';
import { useTrialWarning } from '../hooks/useSubscription';

/**
 * Deneme süresi uyarı banner'ı
 * Son 7 günde gösterilir, urgency'e göre renk değişir
 */
const TrialWarningBanner = ({ sectorId, onUpgrade, onDismiss }) => {
  const { shouldShowWarning, isUrgent, isCritical, daysLeft, warningMessage } = useTrialWarning(sectorId);

  if (!shouldShowWarning) {
    return null;
  }

  // Urgency'e göre stil
  const bannerStyles = isCritical
    ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
    : isUrgent
      ? 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400'
      : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400';

  const iconColor = isCritical
    ? 'text-red-500'
    : isUrgent
      ? 'text-orange-500'
      : 'text-yellow-500';

  return (
    <div className={`border rounded-lg p-3 mb-4 ${bannerStyles}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 ${iconColor}`}>
            {isCritical ? (
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">{warningMessage}</p>
            <p className="text-xs opacity-80 mt-0.5">
              Verileriniz güvende kalacak, ancak erişim kilitlenecek.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            <span>Şimdi Yükselt</span>
          </button>
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Küçük trial badge (sidebar veya header için)
 */
export const TrialBadge = ({ sectorId }) => {
  const { shouldShowWarning, isCritical, daysLeft } = useTrialWarning(sectorId);

  if (!shouldShowWarning) {
    return null;
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full
        ${isCritical
          ? 'bg-red-500/20 text-red-600 dark:text-red-400 animate-pulse'
          : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
        }
      `}
    >
      <Clock className="w-3 h-3" />
      {daysLeft === 0 ? 'Bugün bitiyor' : `${daysLeft} gün`}
    </span>
  );
};

export default TrialWarningBanner;
