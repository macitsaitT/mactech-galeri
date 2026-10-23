"""
Finansal sınıflandırma servisi.

Muhasebe prensiplerine uygun şekilde işlemleri 3 sınıfa ayırır:

1. VEHICLE_COST  → Araç maliyetine eklenir. Öz sermayeyi azaltmaz.
                    Satışta brüt kâr hesabında düşülür.
                    Örnek: Araç Alımı, Sahibine Ödeme, Ekspertiz, Noter, Çekici,
                    Bakım, Detaylı Yıkama, Plaka, Boyacı vb.

2. OPERATING     → İşletme gideridir. Anında öz sermayeyi azaltır.
                    Örnek: Kira, Maaş, SGK, Reklam, Vergi, Elektrik, İnternet,
                    Muhasebe, Ofis Gideri, Sigorta, Temizlik.

3. NEUTRAL       → Sermayeyi etkilemeyen, denetim amaçlı kategoriler.
                    Örnek: Kapora İadesi (alıcıya iade), Çalışan Payı,
                    Kapora Alındı (gelir tarafında, satış olmadığı için kâra eklenmez).

Bu sınıflandırma hem `transactions.expense_type` migrasyonu için, hem de
runtime `/api/finance/summary` hesaplamaları için tek doğruluk kaynağıdır.
"""
from typing import Literal

ExpenseClass = Literal["vehicle_cost", "operating", "neutral"]

# Araç maliyetine eklenen kategoriler (varlık dönüşümü)
VEHICLE_COST_CATEGORIES = {
    "Araç Alımı",
    "Araç Sahibine Ödeme",
    "Ekspertiz",
    "Noter",
    "Çekici",
    "Taşıma/Çekici",
    "Nakliye",
    "Bakım",
    "Bakım/Onarım",
    "Detaylı Yıkama",
    "Hazırlık",
    "Plaka",
    "Boyacı",
    "Kaporta",
    "Lastik",
    "Yedek Parça",
}

# İşletme gideri kategorileri (anlık sermaye azaltıcı)
OPERATING_CATEGORIES = {
    "Personel Maaşı",
    "Maaş",
    "SGK",
    "Kira",
    "Ofis Gideri",
    "Elektrik/Su/Doğalgaz",
    "İnternet/Telefon",
    "Sigorta",
    "Vergi",
    "Reklam/Pazarlama",
    "Reklam",
    "Muhasebe",
    "Temizlik",
    "Kırtasiye",
    "Yemek/İkram",
    "Ulaşım",
    "Diğer Gider",
    "Diğer",
}

# Sermayeyi etkilemeyen / iade-niteliğinde kategoriler
NEUTRAL_CATEGORIES = {
    "Kapora İadesi",
    "Çalışan Payı",
}


def classify_expense(category: str | None, car_id: str | None = None) -> ExpenseClass:
    """
    Bir gider tx'inin sınıfını döndür.

    Heuristik:
    - Açıkça VEHICLE_COST kategorisindeyse → vehicle_cost
    - Açıkça OPERATING kategorisindeyse  → operating
    - NEUTRAL ise → neutral
    - Bilinmeyen ama car_id'ye bağlıysa → vehicle_cost (araca özel masraf varsayımı)
    - Diğer her durumda → operating (güvenli default, çünkü işletme giderlerini
      eksik göstermek kullanıcıyı yanıltmaktan beter; fazla göstermek sermayeyi
      sadece olduğundan kötümser gösterir)
    """
    cat = (category or "").strip()
    if cat in VEHICLE_COST_CATEGORIES:
        return "vehicle_cost"
    if cat in OPERATING_CATEGORIES:
        return "operating"
    if cat in NEUTRAL_CATEGORIES:
        return "neutral"
    # Bilinmeyen kategori — car_id'ye bağlıysa araç maliyeti say
    if car_id:
        return "vehicle_cost"
    return "operating"


__all__ = [
    "VEHICLE_COST_CATEGORIES",
    "OPERATING_CATEGORIES",
    "NEUTRAL_CATEGORIES",
    "classify_expense",
    "ExpenseClass",
]
