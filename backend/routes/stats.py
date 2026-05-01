from fastapi import APIRouter, Depends

from db import db
from auth import get_current_user
from helpers import build_data_filter

router = APIRouter()


@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    query = build_data_filter(current_user, include_deleted=False)

    cars = await db.cars.find(query, {"_id": 0}).to_list(1000)

    stock_cars = [c for c in cars if c.get("status") == "Stokta"]
    consignment_cars = [c for c in cars if c.get("ownership") == "consignment" and c.get("status") != "Satıldı"]
    sold_cars = [c for c in cars if c.get("status") == "Satıldı"]
    deposit_cars = [c for c in cars if c.get("status") == "Kapora Alındı"]

    transactions = await db.transactions.find(build_data_filter(current_user, include_deleted=False), {"_id": 0}).to_list(5000)

    total_income = sum(t.get("amount", 0) for t in transactions if t.get("type") == "income")
    total_expense = sum(t.get("amount", 0) for t in transactions if t.get("type") == "expense")

    stock_value = sum(c.get("purchase_price", 0) for c in stock_cars)

    cust_query = build_data_filter(current_user, include_deleted=False)
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
