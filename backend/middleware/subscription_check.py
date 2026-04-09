"""
Subscription ve Trial Erişim Kontrolü Middleware
"""
from fastapi import HTTPException
from datetime import datetime, timezone


def check_user_access(user: dict) -> dict:
    """
    Kullanıcının uygulamaya erişim yetkisi olup olmadığını kontrol eder
    
    Erişim Kuralları:
    1. Pro + payment_status: "active" + subscription_end_date > now → ✅ Tam erişim (Aylık/Yıllık)
    2. Trial aktif + trial_end > now → ✅ Tam erişim
    3. Trial dolmuş → ❌ Erişim yok (trial_expired)
    4. Pro + subscription_end_date < now → ❌ Erişim yok (subscription_expired)
    5. Pro + payment_status: "past_due" → ❌ Erişim yok (payment_required)
    6. Free (trial yok) → ❌ Erişim yok (no_subscription)
    
    Returns:
        {
            "has_access": bool,
            "reason": str,
            "message": str,
            "redirect_url": str
        }
    """
    
    subscription = user.get("subscription", "free")
    payment_status = user.get("payment_status", "")
    payment_frequency = user.get("payment_frequency", "monthly")  # monthly | yearly
    trial_active = user.get("trial_active", False)
    trial_end = user.get("trial_end")
    subscription_end_date = user.get("subscription_end_date")  # Yıllık için bitiş tarihi
    access_blocked = user.get("access_blocked", False)
    access_blocked_reason = user.get("access_blocked_reason", "")
    
    now = datetime.now(timezone.utc)
    
    # Manuel olarak erişim engellenmiş mi?
    if access_blocked:
        if access_blocked_reason == "payment_failed":
            return {
                "has_access": False,
                "reason": "payment_required",
                "message": "Abonelik ödemeniz bekleniyor. Lütfen ödeme yapın.",
                "redirect_url": "https://www.mactech.tr/odeme",
                "action": "show_payment_required"
            }
        elif access_blocked_reason == "subscription_cancelled":
            return {
                "has_access": False,
                "reason": "subscription_cancelled",
                "message": "Aboneliğiniz iptal edildi. Tekrar aktif etmek için Pro'ya geçin.",
                "redirect_url": "https://www.mactech.tr/pro",
                "action": "show_subscription_cancelled"
            }
        elif access_blocked_reason == "subscription_expired":
            return {
                "has_access": False,
                "reason": "subscription_expired",
                "message": f"{'Yıllık' if payment_frequency == 'yearly' else 'Aylık'} aboneliğiniz sona erdi. Yenilemek için ödeme yapın.",
                "redirect_url": "https://www.mactech.tr/yenile",
                "action": "show_subscription_expired"
            }
    
    # 1. Pro + Active Payment Kontrolü
    if subscription == "pro" and payment_status == "active":
        # Yıllık abonelik varsa bitiş tarihini kontrol et
        if subscription_end_date:
            try:
                end_date = datetime.fromisoformat(subscription_end_date.replace('Z', '+00:00'))
                
                if now < end_date:
                    # Abonelik hala aktif
                    days_left = (end_date - now).days
                    
                    return {
                        "has_access": True,
                        "reason": "pro_active",
                        "message": f"{'Yıllık' if payment_frequency == 'yearly' else 'Pro'} plan aktif",
                        "subscription_type": "pro",
                        "payment_frequency": payment_frequency,
                        "days_until_renewal": days_left,
                        "subscription_end_date": subscription_end_date
                    }
                else:
                    # Abonelik süresi dolmuş
                    return {
                        "has_access": False,
                        "reason": "subscription_expired",
                        "message": f"{'Yıllık' if payment_frequency == 'yearly' else 'Aylık'} aboneliğiniz sona erdi. Yenilemek için ödeme yapın.",
                        "redirect_url": "https://www.mactech.tr/yenile",
                        "action": "show_subscription_expired"
                    }
            except (ValueError, TypeError):
                pass
        
        # Subscription end date yoksa (eski kullanıcılar) - aylık olarak kabul et
        return {
            "has_access": True,
            "reason": "pro_active",
            "message": "Pro plan aktif",
            "subscription_type": "pro",
            "payment_frequency": "monthly"
        }
    
    # 2. Trial Kontrolü
    if trial_active and trial_end:
        try:
            trial_end_date = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
            
            # Trial hala aktif mi?
            if now < trial_end_date:
                days_left = (trial_end_date - now).days
                return {
                    "has_access": True,
                    "reason": "trial_active",
                    "message": f"Deneme süresi aktif ({days_left} gün kaldı)",
                    "subscription_type": "trial",
                    "trial_days_left": days_left,
                    "trial_end": trial_end
                }
            else:
                # Trial dolmuş
                return {
                    "has_access": False,
                    "reason": "trial_expired",
                    "message": "14 günlük deneme süreniz sona erdi. Pro plana geçerek devam edin!",
                    "redirect_url": "https://www.mactech.tr/pro",
                    "action": "show_trial_expired"
                }
        except (ValueError, TypeError):
            pass
    
    # 3. Pro ama Ödeme Durumu Sorunlu
    if subscription == "pro" and payment_status == "past_due":
        return {
            "has_access": False,
            "reason": "payment_required",
            "message": "Abonelik ödemeniz bekleniyor. Lütfen ödeme yapın.",
            "redirect_url": "https://www.mactech.tr/odeme",
            "action": "show_payment_required"
        }
    
    # 4. Free (Trial Başlatmamış)
    return {
        "has_access": False,
        "reason": "no_subscription",
        "message": "Galeri CRM'i kullanmak için 14 günlük ücretsiz deneme başlatın veya Pro plana geçin.",
        "redirect_url": "https://www.mactech.tr/uygulamalar/galeri",
        "action": "show_start_trial"
    }


def require_active_subscription(user: dict):
    """
    API endpoint'lerinde kullanılacak decorator benzeri fonksiyon
    Erişim yoksa HTTPException raise eder
    """
    access_check = check_user_access(user)
    
    if not access_check["has_access"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "access_denied",
                "reason": access_check["reason"],
                "message": access_check["message"],
                "redirect_url": access_check.get("redirect_url"),
                "action": access_check.get("action")
            }
        )
    
    return access_check
