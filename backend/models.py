from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


class UserCreate(BaseModel):
    email: str
    password: str
    company_name: str = "Aslanba Oto"
    phone: str = ""
    email_verified: bool = False
    role: str = "satis"


class UserLogin(BaseModel):
    email: str
    password: str


class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    company_name: str = "Aslanba Oto"
    phone: str = ""
    address: str = ""
    logo_url: str = ""
    theme: str = "dark"
    role: str = "admin"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    theme: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None


class CarBase(BaseModel):
    brand: str
    model: str
    year: int
    plate: str
    km: str = ""
    vehicle_type: str = "Sedan"
    purchase_price: float = 0
    sale_price: float = 0
    description: str = ""
    status: str = "Stokta"
    entry_date: str = ""
    inspection_date: str = ""
    inspection_notification_days: int = 30  # Kaç gün önce bildirim gönderilsin
    fuel_type: str = "Dizel"
    gear: str = "Otomatik"
    ownership: str = "stock"
    owner_name: str = ""
    owner_phone: str = ""
    commission_rate: float = 0
    photos: List[str] = []
    expertise: dict = {}
    package_info: str = ""
    engine_type: str = ""
    deposit_amount: float = 0
    deposit_customer_id: Optional[str] = None
    deposit_customer_name: Optional[str] = None
    deposit_date: Optional[str] = None
    sold_date: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    employee_share: float = 0
    insurance_start: str = ""
    insurance_end: str = ""
    province: str = ""
    district: str = ""
    expertise_score: int = 95
    tramer_amount: float = 0
    expertise_notes: str = ""
    # Fatura Bilgileri
    is_invoiced: bool = False  # Faturalı alım mı?
    invoice_number: str = ""
    invoice_date: str = ""
    invoice_seller_name: str = ""
    invoice_seller_tax_id: str = ""  # TC/Vergi No
    invoice_seller_address: str = ""
    # Araç Belgeleri
    documents: dict = {
        "ruhsat": [],
        "muayene": [],
        "sigorta": [],
        "ekspertiz": [],
        "vekaletname": [],
        "diger": []
    }


class CarCreate(CarBase):
    pass


class Car(CarBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    org_id: Optional[str] = None
    created_by: Optional[str] = None
    deleted: bool = False
    deleted_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CustomerBase(BaseModel):
    name: str
    phone: str = ""
    type: str = "Potansiyel"
    notes: str = ""
    interested_car_id: str = ""


class CustomerCreate(CustomerBase):
    pass


class Customer(CustomerBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    org_id: Optional[str] = None
    created_by: Optional[str] = None
    deleted: bool = False
    deleted_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TransactionBase(BaseModel):
    type: str
    category: str
    description: str = ""
    amount: float
    date: str
    car_id: Optional[str] = None
    employee_name: Optional[str] = None


class TransactionCreate(TransactionBase):
    pass


class Transaction(TransactionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    org_id: Optional[str] = None
    created_by: Optional[str] = None
    deleted: bool = False
    deleted_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AppointmentBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str
    customer_name: str = ""
    customer_phone: str = ""
    car_id: str = ""
    car_info: str = ""
    date: str = ""
    time: str = ""
    notes: str = ""
    status: str = "Bekliyor"
