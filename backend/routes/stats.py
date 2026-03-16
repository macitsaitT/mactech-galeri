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
