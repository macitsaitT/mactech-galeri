from fastapi import APIRouter, Depends
from datetime import datetime

from db import db
from auth import get_current_user
from helpers import build_data_filter

router = APIRouter()


@router.get("/stats")
async def get_stats(branch_id: str = None, current_user: dict = Depends(get_current_user)):
    extra = {"branch_id": branch_id} if branch_id else None
    query = build_data_filter(current_user, extra, include_deleted=False)

    cars = await db.cars.find(query, {"_id": 0}).to_list(1000)

    stock_cars = [c for c in cars if c.get("status") == "Stokta"]
    consignment_cars = [c for c in cars if c.get("ownership") == "consignment" and c.get("status") != "Satıldı"]
    sold_cars = [c for c in cars if c.get("status") == "Satıldı"]
    deposit_cars = [c for c in cars if c.get("status") == "Kapora Alındı"]

    tx_query = build_data_filter(current_user, extra, include_deleted=False)
    transactions = await db.transactions.find(tx_query, {"_id": 0}).to_list(5000)

    total_income = sum(t.get("amount", 0) for t in transactions if t.get("type") == "income")
    total_expense = sum(t.get("amount", 0) for t in transactions if t.get("type") == "expense")

    stock_value = sum(c.get("purchase_price", 0) for c in stock_cars)

    cust_query = build_data_filter(current_user, extra, include_deleted=False)
    customers = await db.customers.count_documents(cust_query)

    return {
        "total_cars": len(cars),
        "stock_cars": len(stock_cars),
        "consignment_cars": len(consignment_cars),
        "sold_cars": len(sold_cars),
        "deposit_cars": len(deposit_cars),
        "total_income": total_income,
        "total_expense": total_expense,
        "net_profit": total_income - total_expense,
        "stock_value": stock_value,
        "total_customers": customers
    }



@router.get("/stats/employee-performance")
async def get_employee_performance(current_user: dict = Depends(get_current_user)):
    """Personel bazlı satış performansı: sattığı araç sayısı, toplam ciro, toplam kar.

    Admin / muhasebe tüm personeli görür; diğerleri yalnızca kendini.
    """
    role = current_user.get("role", "admin")
    org_id = current_user.get("org_id", current_user["user_id"])

    # Tüm çalışanları getir
    users = await db.users.find({"org_id": org_id}, {
        "_id": 0, "id": 1, "company_name": 1, "email": 1, "role": 1
    }).to_list(200)

    if role not in ("admin", "muhasebe"):
        users = [u for u in users if u.get("id") == current_user["user_id"]]

    # Satılan araçlar
    sold_cars = await db.cars.find(
        {"org_id": org_id, "status": "Satıldı", "deleted": {"$ne": True}}, {"_id": 0}
    ).to_list(10000)

    # Bu araçlarla ilgili giderleri önceden grupla
    tx_list = await db.transactions.find(
        {"org_id": org_id, "type": "expense", "deleted": {"$ne": True}}, {"_id": 0}
    ).to_list(50000)
    tx_by_car: dict = {}
    for t in tx_list:
        cid = t.get("car_id")
        if not cid:
            continue
        tx_by_car.setdefault(cid, []).append(t)

    def _car_cost(car: dict) -> float:
        """Aracın toplam maliyeti: alış + sahibe ödeme + dışarı araç giderleri + çalışan payı."""
        cid = car.get("id")
        car_txs = tx_by_car.get(cid, [])
        owner_pay = sum(float(t.get("amount", 0) or 0) for t in car_txs if t.get("category") == "Araç Sahibine Ödeme")
        employee_share = sum(float(t.get("amount", 0) or 0) for t in car_txs if t.get("category") == "Çalışan Payı")
        other_expenses = sum(
            float(t.get("amount", 0) or 0)
            for t in car_txs
            if t.get("category") not in ("Araç Alımı", "Araç Sahibine Ödeme", "Çalışan Payı")
        )
        purchase = float(car.get("purchase_price", 0) or 0) if car.get("ownership") == "stock" else 0.0
        return purchase + owner_pay + other_expenses + employee_share

    # Personel bazlı topla
    perf_map: dict = {}
    for u in users:
        uid = u.get("id")
        perf_map[uid] = {
            "user_id": uid,
            "user_name": u.get("company_name") or u.get("email", ""),
            "role": u.get("role", "satis"),
            "sold_count": 0,
            "total_revenue": 0.0,
            "total_cost": 0.0,
            "total_profit": 0.0,
            "total_employee_share": 0.0,
        }

    # Atanmamış araçlar için placeholder bucket
    unassigned = {
        "user_id": "",
        "user_name": "Atanmamış / Bilinmiyor",
        "role": "",
        "sold_count": 0,
        "total_revenue": 0.0,
        "total_cost": 0.0,
        "total_profit": 0.0,
        "total_employee_share": 0.0,
    }

    for car in sold_cars:
        sold_uid = car.get("sold_by_user_id") or ""
        bucket = perf_map.get(sold_uid, unassigned)
        sale = float(car.get("sale_price", 0) or 0)
        cost = _car_cost(car)
        profit = sale - cost
        emp_share = float(car.get("employee_share", 0) or 0)
        bucket["sold_count"] += 1
        bucket["total_revenue"] += sale
        bucket["total_cost"] += cost
        bucket["total_profit"] += profit
        bucket["total_employee_share"] += emp_share

    results = list(perf_map.values())
    if unassigned["sold_count"] > 0 and role in ("admin", "muhasebe"):
        # satis rolündeki kullanıcı 'Atanmamış' bucket üzerinden toplam satış sayısını öğrenmesin
        results.append(unassigned)

    # Çok satandan aza sırala
    results.sort(key=lambda x: x["sold_count"], reverse=True)

    totals = {
        "sold_count": sum(r["sold_count"] for r in results),
        "total_revenue": sum(r["total_revenue"] for r in results),
        "total_cost": sum(r["total_cost"] for r in results),
        "total_profit": sum(r["total_profit"] for r in results),
        "total_employee_share": sum(r["total_employee_share"] for r in results),
    }

    return {"performance": results, "totals": totals}


@router.get("/stats/sales-breakdown")
async def get_sales_breakdown(
    period: str = "monthly",
    year: int = None,
    current_user: dict = Depends(get_current_user),
):
    """Aylık/yıllık satış ve kâr kırılımı (personel performans grafiği için).

    period: 'monthly' (tek yıl, 12 ay) veya 'yearly' (son 5 yıl).
    year: monthly için opsiyonel; default = içinde bulunulan yıl.
    """
    from datetime import datetime as _dt

    org_id = current_user.get("org_id", current_user["user_id"])
    role = current_user.get("role", "admin")
    now_year = _dt.utcnow().year

    # Satılan araçları çek
    q = {"org_id": org_id, "status": "Satıldı", "deleted": {"$ne": True}}
    if role not in ("admin", "muhasebe"):
        q["sold_by_user_id"] = current_user["user_id"]
    sold_cars = await db.cars.find(q, {"_id": 0}).to_list(20000)

    # Araç bazlı giderleri pre-grupla
    tx_list = await db.transactions.find(
        {"org_id": org_id, "type": "expense", "deleted": {"$ne": True}}, {"_id": 0}
    ).to_list(50000)
    tx_by_car: dict = {}
    for t in tx_list:
        cid = t.get("car_id")
        if not cid:
            continue
        tx_by_car.setdefault(cid, []).append(t)

    def _car_cost(car: dict) -> float:
        cid = car.get("id")
        car_txs = tx_by_car.get(cid, [])
        owner_pay = sum(float(t.get("amount", 0) or 0) for t in car_txs if t.get("category") == "Araç Sahibine Ödeme")
        employee_share = sum(float(t.get("amount", 0) or 0) for t in car_txs if t.get("category") == "Çalışan Payı")
        other = sum(
            float(t.get("amount", 0) or 0) for t in car_txs
            if t.get("category") not in ("Araç Alımı", "Araç Sahibine Ödeme", "Çalışan Payı")
        )
        purchase = float(car.get("purchase_price", 0) or 0) if car.get("ownership") == "stock" else 0.0
        return purchase + owner_pay + other + employee_share

    if period == "monthly":
        target_year = year or now_year
        buckets = {i: {"label": f"{i:02d}", "sold_count": 0, "revenue": 0.0, "profit": 0.0} for i in range(1, 13)}
        for car in sold_cars:
            sd = car.get("sold_date") or ""
            if not sd or not sd.startswith(str(target_year)):
                continue
            try:
                month = int(sd.split("-")[1])
            except Exception:
                continue
            if month not in buckets:
                continue
            sale = float(car.get("sale_price", 0) or 0)
            profit = sale - _car_cost(car)
            b = buckets[month]
            b["sold_count"] += 1
            b["revenue"] += sale
            b["profit"] += profit
        data = [buckets[m] for m in range(1, 13)]
        return {"period": "monthly", "year": target_year, "data": data}

    # Yearly — son 5 yıl
    years = sorted({(car.get("sold_date") or "0000")[:4] for car in sold_cars if car.get("sold_date")})
    years = [y for y in years if y and y.isdigit()][-5:]
    if not years:
        years = [str(now_year)]
    buckets = {y: {"label": y, "sold_count": 0, "revenue": 0.0, "profit": 0.0} for y in years}
    for car in sold_cars:
        sd = car.get("sold_date") or ""
        yr = sd[:4]
        if yr not in buckets:
            continue
        sale = float(car.get("sale_price", 0) or 0)
        profit = sale - _car_cost(car)
        b = buckets[yr]
        b["sold_count"] += 1
        b["revenue"] += sale
        b["profit"] += profit
    return {"period": "yearly", "data": list(buckets.values())}


@router.get("/stats/stock-aging")
async def get_stock_aging(current_user: dict = Depends(get_current_user)):
    """Stokta 30+ gün kalan araçlar ve günlük maliyet tahmini.

    Kullanıcı kendi settings'inde `daily_stock_cost_pct` ile yıllık %X sermaye maliyeti
    tanımlarsa buna göre günlük maliyet hesaplanır. Default %18 yıllık.
    """
    from datetime import date as _date

    org_id = current_user.get("org_id", current_user["user_id"])
    owner = await db.users.find_one({"id": org_id}, {"_id": 0}) or {}
    yearly_rate = float(owner.get("stock_cost_yearly_pct", 18)) / 100.0
    daily_rate = yearly_rate / 365.0

    cars = await db.cars.find(
        {"org_id": org_id, "deleted": {"$ne": True}, "status": "Stokta"}, {"_id": 0}
    ).to_list(5000)

    today = _date.today()
    rows = []
    buckets = {"0-30": 0, "31-60": 0, "61-90": 0, "91+": 0}
    total_capital = 0.0
    total_daily_cost = 0.0

    for car in cars:
        entry = car.get("entry_date") or ""
        try:
            entry_date = datetime.strptime(entry, "%Y-%m-%d").date()
            days = max(0, (today - entry_date).days)
        except Exception:
            days = 0
        purchase = float(car.get("purchase_price", 0) or 0) if car.get("ownership") == "stock" else 0.0
        daily_cost = purchase * daily_rate
        accumulated_cost = daily_cost * days

        if days <= 30:
            buckets["0-30"] += 1
        elif days <= 60:
            buckets["31-60"] += 1
        elif days <= 90:
            buckets["61-90"] += 1
        else:
            buckets["91+"] += 1

        rows.append({
            "car_id": car.get("id"),
            "plate": (car.get("plate") or "").upper(),
            "brand": car.get("brand", ""),
            "model": car.get("model", ""),
            "year": car.get("year"),
            "entry_date": entry,
            "days_in_stock": days,
            "purchase_price": purchase,
            "daily_cost": round(daily_cost, 2),
            "accumulated_cost": round(accumulated_cost, 2),
            "ownership": car.get("ownership", "stock"),
            "is_stale": days > 30,
        })
        total_capital += purchase
        total_daily_cost += daily_cost

    rows.sort(key=lambda r: -r["days_in_stock"])
    return {
        "rows": rows,
        "buckets": buckets,
        "totals": {
            "total_cars": len(rows),
            "stale_cars": sum(1 for r in rows if r["is_stale"]),
            "total_capital": round(total_capital, 2),
            "daily_cost": round(total_daily_cost, 2),
            "yearly_rate_pct": round(yearly_rate * 100, 2),
        },
    }

