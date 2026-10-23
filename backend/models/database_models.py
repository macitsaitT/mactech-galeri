# MACTech Multi-Tenant SaaS - Veritabanı Modelleri
# /backend/models/database_models.py

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid


# ==================== ENUM TANIMLAMALARI ====================

class AuthProvider(str, Enum):
    EMAIL = "email"
    GOOGLE = "google"
    APPLE = "apple"


class UserRole(str, Enum):
    OWNER = "owner"          # Organizasyon sahibi
    ADMIN = "admin"          # Tam yetki
    MANAGER = "manager"      # Yönetici
    EDITOR = "editor"        # Düzenleme yetkisi
    VIEWER = "viewer"        # Sadece görüntüleme


class SectorType(str, Enum):
    GALLERY = "gallery"           # Oto Galeri
    REALESTATE = "realestate"     # Emlak
    LOGISTICS = "logistics"       # Lojistik
    ACCOUNTING = "accounting"     # Muhasebe


class SubscriptionStatus(str, Enum):
    TRIAL = "trial"               # Deneme süresi
    ACTIVE = "active"             # Aktif abonelik
    PAST_DUE = "past_due"         # Ödeme gecikmiş
    EXPIRED = "expired"           # Süresi dolmuş
    CANCELLED = "cancelled"       # İptal edilmiş
    LOCKED = "locked"             # Kilitli (ödeme bekleniyor)


class PlanType(str, Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


# ==================== GLOBAL USER (TEK KULLANICI TABLOSU) ====================

class User(BaseModel):
    """
    Global kullanıcı tablosu - SSO için tek kaynak
    Tüm platformlarda (web, mobil, tüm sektörler) aynı user_id kullanılır
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Kimlik Bilgileri
    email: EmailStr
    password_hash: Optional[str] = None
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    
    # Auth Provider
    auth_provider: AuthProvider = AuthProvider.EMAIL
    google_id: Optional[str] = None
    apple_id: Optional[str] = None
    
    # Doğrulama
    email_verified: bool = False
    phone_verified: bool = False
    verification_code: Optional[str] = None
    
    # Meta
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ==================== ORGANIZATION (ŞİRKET/GALERİ) ====================

class Organization(BaseModel):
    """
    Organizasyon/Şirket tablosu
    Her organizasyon birden fazla sektöre sahip olabilir
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Temel Bilgiler
    name: str
    slug: str                     # URL-friendly isim (aslanbasoto)
    logo_url: Optional[str] = None
    
    # İletişim
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "TR"
    
    # Vergi Bilgileri
    tax_office: Optional[str] = None
    tax_number: Optional[str] = None
    
    # Sahip
    owner_id: str                 # User.id referansı
    
    # Ayarlar
    timezone: str = "Europe/Istanbul"
    currency: str = "TRY"
    language: str = "tr"
    
    # Meta
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ==================== USER_SECTORS (KULLANICI-SEKTÖR İLİŞKİSİ) ====================

class UserSector(BaseModel):
    """
    Kullanıcının hangi organizasyonda hangi sektöre erişimi olduğunu tanımlar
    Multi-tenancy için kritik tablo
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # İlişkiler
    user_id: str                  # User.id
    organization_id: str          # Organization.id
    sector_id: SectorType         # gallery, realestate, etc.
    
    # Yetki
    role: UserRole = UserRole.VIEWER
    permissions: Dict[str, bool] = Field(default_factory=dict)
    
    # Davet
    invited_by: Optional[str] = None    # User.id
    invited_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    
    # Meta
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ==================== SECTORS (SEKTÖR TANIMLARI) ====================

class Sector(BaseModel):
    """
    Sektör tanımları (Gallery, Realestate, etc.)
    """
    id: SectorType
    name: str
    description: str
    icon: str
    color: str
    is_active: bool = True
    features: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== PLANS (ABONELİK PLANLARI) ====================

class Plan(BaseModel):
    """
    Abonelik planları
    Her sektör için farklı planlar olabilir
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Plan Bilgileri
    sector_id: SectorType
    name: str
    type: PlanType
    description: str
    
    # Fiyatlandırma
    price_monthly: float
    price_yearly: float
    currency: str = "TRY"
    
    # Deneme Süresi
    trial_days: int = 14
    
    # iyzico Referansları
    iyzico_product_ref: Optional[str] = None
    iyzico_plan_ref_monthly: Optional[str] = None
    iyzico_plan_ref_yearly: Optional[str] = None
    
    # Özellikler ve Limitler
    features: Dict[str, Any] = Field(default_factory=dict)
    limits: Dict[str, int] = Field(default_factory=dict)
    
    # Meta
    is_active: bool = True
    is_popular: bool = False
    sort_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ==================== SUBSCRIPTIONS (ABONELİKLER) ====================

class Subscription(BaseModel):
    """
    Abonelik kayıtları
    Organizasyonun sektör bazlı abonelik durumu
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # İlişkiler
    organization_id: str
    sector_id: SectorType
    plan_id: str
    
    # Durum
    status: SubscriptionStatus = SubscriptionStatus.TRIAL
    
    # Deneme Süresi
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    
    # Abonelik Periyodu
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    
    # İptal
    cancel_at_period_end: bool = False
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    
    # iyzico Bilgileri
    iyzico_customer_ref: Optional[str] = None
    iyzico_subscription_ref: Optional[str] = None
    
    # Ödeme Geçmişi
    last_payment_date: Optional[datetime] = None
    last_payment_amount: Optional[float] = None
    failed_payment_count: int = 0
    
    # Kilitleme (Ödeme beklenirken)
    locked_at: Optional[datetime] = None
    lock_reason: Optional[str] = None
    
    # Meta
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ==================== SUBSCRIPTION_HISTORY (ABONELİK GEÇMİŞİ) ====================

class SubscriptionHistory(BaseModel):
    """
    Abonelik değişiklik geçmişi
    Audit trail için
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    subscription_id: str
    organization_id: str
    sector_id: SectorType
    
    # Değişiklik
    action: str                   # created, upgraded, downgraded, cancelled, renewed, locked, unlocked
    from_status: Optional[SubscriptionStatus] = None
    to_status: SubscriptionStatus
    from_plan_id: Optional[str] = None
    to_plan_id: Optional[str] = None
    
    # Kim yaptı
    performed_by: Optional[str] = None    # User.id veya "system"
    
    # Meta
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ==================== PAYMENTS (ÖDEME KAYITLARI) ====================

class Payment(BaseModel):
    """
    Ödeme kayıtları
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # İlişkiler
    organization_id: str
    subscription_id: str
    
    # Ödeme Bilgileri
    amount: float
    currency: str = "TRY"
    status: str                   # success, failed, pending, refunded
    
    # iyzico
    iyzico_payment_id: Optional[str] = None
    iyzico_conversation_id: Optional[str] = None
    
    # Detaylar
    payment_method: str = "credit_card"
    card_last_four: Optional[str] = None
    card_brand: Optional[str] = None
    
    # Hata
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    
    # Meta
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ==================== MONGODB COLLECTION INDEXES ====================

"""
MongoDB Index Önerileri (db.py veya migration script'te oluşturulmalı):

# Users
db.users.create_index("email", unique=True)
db.users.create_index("google_id", sparse=True)
db.users.create_index("apple_id", sparse=True)

# Organizations
db.organizations.create_index("slug", unique=True)
db.organizations.create_index("owner_id")

# User Sectors (Multi-tenancy için kritik!)
db.user_sectors.create_index([("user_id", 1), ("organization_id", 1), ("sector_id", 1)], unique=True)
db.user_sectors.create_index("organization_id")
db.user_sectors.create_index("user_id")

# Subscriptions
db.subscriptions.create_index([("organization_id", 1), ("sector_id", 1)], unique=True)
db.subscriptions.create_index("status")
db.subscriptions.create_index("trial_end")
db.subscriptions.create_index("current_period_end")

# Payments
db.payments.create_index("organization_id")
db.payments.create_index("subscription_id")
db.payments.create_index("created_at")

# Sektör-spesifik tablolar (her zaman organization_id + sector_id index'i olmalı)
db.gallery_cars.create_index([("organization_id", 1), ("sector_id", 1)])
db.gallery_customers.create_index([("organization_id", 1), ("sector_id", 1)])
# vs...
"""
