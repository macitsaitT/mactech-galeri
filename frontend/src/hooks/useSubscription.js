// MACTech Multi-Tenant SaaS - Subscription Status Hook
// /frontend/src/hooks/useSubscription.js

import { useState, useEffect, useCallback } from 'react';
import { subscriptionAPI } from '../services/apiMultiTenant';

/**
 * Abonelik durumunu yöneten custom hook
 * 
 * Kullanım:
 * const { subscription, isLoading, isTrial, daysLeft, refresh } = useSubscription('gallery');
 */
export const useSubscription = (sectorId) => {
  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    if (!sectorId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await subscriptionAPI.status(sectorId);
      setSubscription(response.data);
    } catch (err) {
      // 402 hatası usePaywall tarafından handle edilir
      if (err.error !== 'payment_required') {
        setError(err.message || 'Abonelik durumu alınamadı');
        console.error('Subscription status error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [sectorId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Computed values
  const isActive = subscription?.status === 'active';
  const isTrial = subscription?.status === 'trial';
  const isExpired = subscription?.status === 'expired' || subscription?.status === 'locked';
  const daysLeft = subscription?.trial_days_left || subscription?.days_remaining || 0;
  const hasAccess = isActive || (isTrial && daysLeft > 0);

  return {
    subscription,
    isLoading,
    error,
    isActive,
    isTrial,
    isExpired,
    daysLeft,
    hasAccess,
    refresh: fetchStatus,
  };
};

/**
 * Tüm sektörlerin abonelik özetini getiren hook
 */
export const useSubscriptionSummary = () => {
  const [summary, setSummary] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await subscriptionAPI.summary();
      setSummary(response.data);
    } catch (err) {
      setError(err.message || 'Abonelik özeti alınamadı');
      console.error('Subscription summary error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    isLoading,
    error,
    refresh: fetchSummary,
  };
};

/**
 * Trial uyarı banner'ı için hook
 */
export const useTrialWarning = (sectorId) => {
  const { subscription, isTrial, daysLeft } = useSubscription(sectorId);

  const shouldShowWarning = isTrial && daysLeft <= 7; // Son 7 gün
  const isUrgent = isTrial && daysLeft <= 3; // Son 3 gün
  const isCritical = isTrial && daysLeft <= 1; // Son gün

  const warningMessage = isTrial
    ? daysLeft === 0
      ? 'Deneme süreniz bugün sona eriyor!'
      : daysLeft === 1
        ? 'Deneme süreniz yarın sona eriyor!'
        : `Deneme süreniz ${daysLeft} gün sonra sona erecek.`
    : null;

  return {
    shouldShowWarning,
    isUrgent,
    isCritical,
    daysLeft,
    warningMessage,
  };
};

export default useSubscription;
