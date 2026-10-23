"""
Finansal Özet Endpoint'leri — Muhasebe Prensipli Hesaplama.

Tek doğruluk kaynağı (single source of truth):
- Başlangıç Sermayesi: org_settings.founding_capital (sabit)
- Kasadaki Nakit: capital.amount (gerçek kasa bakiyesi)
- Stoktaki Araç Değeri: Σ(purchase_price + araç_maliyetleri stoktaki araçlar için)
- Net Kâr: Σ(sale_price - total_cost) sadece satılan araçlardan
- İşletme Giderleri: vehicle_cost OLMAYAN tüm gider tx'leri
- Toplam Varlık: Kasadaki Nakit + Stoktaki Araç Değeri
- Güncel Öz Sermaye: Başlangıç + Net Kâr - İşletme Giderleri
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from typing import Optional

from db import db
from auth import get_current_user
from capital_service import get_capital
from services.expense_classifier import classify_expense, VEHICLE_COST_CATEGORIES

router = APIRouter()

_FINANCE_ROLES = {"admin", "owner", "muhasebe"}


def _require_finance_role(current_user: dict) -> None:
    role = (current_user.get("role") or "").lower()
    if role not in _FINANCE_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Finansal özet sadece yönetici ve muhasebe rolleri tarafından görüntülenebilir.",
        )


@router.get("/finance/summary")
async def get_finance_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Patron'un 5 saniyede şirket durumunu gördüğü özet endpoint.

    Tarih filtresi (start_date / end_date) `Net Kâr` ve `İşletme Giderleri`
    hesaplarını sınırlandırır; ancak `Stoktaki Araç Değeri`, `Kasadaki Nakit`,
    `Toplam Varlık` ve `Başlangıç Sermayesi` her zaman ANLIK toplam değerlerdir
    (tarih filtresinden bağımsız — bilanço kalemleridir).
    """
    _require_finance_role(current_user)
    org_id = current_user.get("org_id", current_user["user_id"])

    # 1) Başlangıç Sermayesi
    founding_doc = await db.org_settings.find_one(
        {"org_id": org_id}, {"_id": 0, "founding_capital": 1}
    )
    founding_capital = float((founding_doc or {}).get("founding_capital", 0) or 0)

    # 2) Kasadaki Nakit
    cap = await get_capital(org_id)
    cash_balance = float((cap or {}).get("amount", 0) or 0)

    # 3) Aktif araçlar + işlemler tek seferde
    cars = await db.cars.find(
        {"org_id": org_id, "deleted": {"$ne": True}},
        {"_id": 0},
    ).to_list(20000)
    txs = await db.transactions.find(
        {"org_id": org_id, "type": "expense", "deleted": {"$ne": True}},
        {"_id": 0},
    ).to_list(50000)

    # Araç bazlı gider haritası
    tx_by_car: dict = {}
    for t in txs:
        cid = t.get("car_id")
        if cid:
            tx_by_car.setdefault(cid, []).append(t)

    def _vehicle_total_cost(car: dict) -> float:
        """Aracın TAM maliyeti: alış + araç-bağlı tüm giderler."""
        cid = car.get("id")
        purchase = float(car.get("purchase_price", 0) or 0) if car.get("ownership") == "stock" else 0.0
        car_txs = tx_by_car.get(cid, [])
        # Sahibine ödeme (konsinye için alış yerine geçer)
        owner_pay = sum(
            float(t.get("amount", 0) or 0)
            for t in car_txs
            if t.get("category") == "Araç Sahibine Ödeme"
        )
        # Diğer araç-bağlı maliyetler — Araç Alımı zaten purchase_price'da, Sahibine Ödeme yukarıda
        other_vehicle_cost = sum(
            float(t.get("amount", 0) or 0)
            for t in car_txs
            if classify_expense(t.get("category"), cid) == "vehicle_cost"
            and t.get("category") not in ("Araç Alımı", "Araç Sahibine Ödeme")
        )
        return purchase + owner_pay + other_vehicle_cost

    # 4) Stoktaki Araç Değeri (tüm stok + konsinye araçlar — henüz satılmamış)
    stock_cars = [c for c in cars if c.get("status") != "Satıldı"]
    stock_value = sum(_vehicle_total_cost(c) for c in stock_cars)
    stock_count = len([c for c in stock_cars if c.get("ownership") == "stock"])
    consignment_count = len([c for c in stock_cars if c.get("ownership") == "consignment"])

    # 5) Net Kâr / Zarar (tarih filtreli)
    sold_cars = [c for c in cars if c.get("status") == "Satıldı"]
    if start_date and end_date:
        sold_cars_period = [
            c for c in sold_cars
            if c.get("sold_date") and start_date <= c["sold_date"] <= end_date
        ]
    else:
        sold_cars_period = sold_cars

    total_revenue = 0.0
    net_profit = 0.0
    loss_amount = 0.0
    profit_amount = 0.0
    for car in sold_cars_period:
        sale = float(car.get("sale_price", 0) or 0)
        cost = _vehicle_total_cost(car)
        # Çalışan payı kâr hesabında düşülür (gerçekte ödenen masraf)
        emp_share = sum(
            float(t.get("amount", 0) or 0)
            for t in tx_by_car.get(car.get("id"), [])
            if t.get("category") == "Çalışan Payı"
        )
        car_profit = sale - cost - emp_share
        total_revenue += sale
        net_profit += car_profit
        if car_profit >= 0:
            profit_amount += car_profit
        else:
            loss_amount += -car_profit

    # 6) İşletme Giderleri (tarih filtreli)
    operating_txs = [
        t for t in txs
        if classify_expense(t.get("category"), t.get("car_id")) == "operating"
    ]
    if start_date and end_date:
        operating_txs_period = [
            t for t in operating_txs
            if t.get("date") and start_date <= t["date"] <= end_date
        ]
    else:
        operating_txs_period = operating_txs
    operating_expense = sum(float(t.get("amount", 0) or 0) for t in operating_txs_period)

    # 7) Tüm zamanlar işletme gideri (öz sermaye için)
    total_operating_all_time = sum(float(t.get("amount", 0) or 0) for t in operating_txs)

    # 8) Tüm zamanlar net kâr (öz sermaye için)
    total_net_profit_all_time = 0.0
    for car in sold_cars:
        sale = float(car.get("sale_price", 0) or 0)
        cost = _vehicle_total_cost(car)
        emp_share = sum(
            float(t.get("amount", 0) or 0)
            for t in tx_by_car.get(car.get("id"), [])
            if t.get("category") == "Çalışan Payı"
        )
        total_net_profit_all_time += (sale - cost - emp_share)

    # 9) Hesaplanmış kartlar
    total_assets = cash_balance + stock_value
    current_equity = founding_capital + total_net_profit_all_time - total_operating_all_time

    # 10) İşletme gideri kategori kırılımı (grafik için)
    operating_breakdown = {}
    for t in operating_txs_period:
        cat = t.get("category") or "Diğer"
        operating_breakdown[cat] = operating_breakdown.get(cat, 0) + float(t.get("amount", 0) or 0)
    operating_breakdown_list = [
        {"category": k, "amount": round(v, 2)}
        for k, v in sorted(operating_breakdown.items(), key=lambda x: -x[1])
    ]

    # 11) Araç yatırımı (tarih filtreli) — yeni stoka giren araçların maliyeti
    vehicle_investment_period = 0.0
    if start_date and end_date:
        for car in cars:
            entry = car.get("entry_date") or ""
            if entry and start_date <= entry <= end_date:
                vehicle_investment_period += float(car.get("purchase_price", 0) or 0) if car.get("ownership") == "stock" else 0.0
        # Araç-bağlı maliyet tx'leri (tarih bazlı)
        for t in txs:
            if not t.get("car_id"):
                continue
            if classify_expense(t.get("category"), t.get("car_id")) != "vehicle_cost":
                continue
            d = t.get("date") or ""
            if d and start_date <= d <= end_date:
                vehicle_investment_period += float(t.get("amount", 0) or 0)

    return {
        # 6 ana kart
        "founding_capital": round(founding_capital, 2),
        "current_equity": round(current_equity, 2),
        "cash_balance": round(cash_balance, 2),
        "stock_value": round(stock_value, 2),
        "net_profit": round(net_profit, 2),
        "total_assets": round(total_assets, 2),

        # Ek detaylar
        "stock_count": stock_count,
        "consignment_count": consignment_count,
        "sold_count_period": len(sold_cars_period),
        "total_revenue_period": round(total_revenue, 2),
        "operating_expense_period": round(operating_expense, 2),
        "total_operating_all_time": round(total_operating_all_time, 2),
        "total_net_profit_all_time": round(total_net_profit_all_time, 2),
        "vehicle_investment_period": round(vehicle_investment_period, 2),
        "loss_amount": round(loss_amount, 2),
        "profit_amount": round(profit_amount, 2),

        # Grafik için
        "operating_breakdown": operating_breakdown_list,

        # Negatif kasa açıklaması — UI'da göstermek için
        "cash_is_negative": cash_balance < 0,
        "cash_explanation": (
            "Kasadan çıkan para stoktaki araçlara bağlanmıştır. "
            "Toplam varlığınız (nakit + stok) sağlıklıdır."
            if cash_balance < 0 else None
        ),
        "equity_change": round(current_equity - founding_capital, 2),
        "equity_change_pct": (
            round((current_equity - founding_capital) / founding_capital * 100, 2)
            if founding_capital > 0 else 0
        ),

        # Tarih filtre bilgisi (frontend için)
        "period": {"start": start_date, "end": end_date} if start_date and end_date else None,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/finance/categories")
async def list_expense_categories(current_user: dict = Depends(get_current_user)):
    """Frontend'in kategori sınıflandırmasını anlaması için referans listesi."""
    _require_finance_role(current_user)
    from services.expense_classifier import (
        VEHICLE_COST_CATEGORIES, OPERATING_CATEGORIES, NEUTRAL_CATEGORIES
    )
    return {
        "vehicle_cost": sorted(VEHICLE_COST_CATEGORIES),
        "operating": sorted(OPERATING_CATEGORIES),
        "neutral": sorted(NEUTRAL_CATEGORIES),
    }
