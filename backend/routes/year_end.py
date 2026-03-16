from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from db import db
from auth import get_current_user
from helpers import build_data_filter

router = APIRouter()


@router.get("/year-end-transfers")
async def get_year_end_transfers(current_user: dict = Depends(get_current_user)):
    if current_user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Sadece admin bu islemi yapabilir")
    org_id = current_user.get("org_id", current_user["user_id"])
    transfers = await db.year_end_transfers.find({"org_id": org_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return transfers


@router.post("/year-end-transfer")
async def create_year_end_transfer(body: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Sadece admin bu islemi yapabilir")

    year = body.get("year")
    if not year or not isinstance(year, int):
        raise HTTPException(status_code=400, detail="Gecerli bir yil belirtin")

    org_id = current_user.get("org_id", current_user["user_id"])

    # Check if transfer already done for this year
    existing = await db.year_end_transfers.find_one({"org_id": org_id, "year": year})
    if existing:
        raise HTTPException(status_code=400, detail=f"{year} yili icin devir zaten yapilmis")

    # Calculate year's income and expenses
    query = build_data_filter(current_user, include_deleted=False)
    all_transactions = await db.transactions.find(query, {"_id": 0}).to_list(50000)

    year_start = f"{year}-01-01"
    year_end = f"{year}-12-31"

    year_transactions = [
        t for t in all_transactions
        if t.get("date", "") >= year_start and t.get("date", "") <= year_end
        and t.get("category") != "Devir Bakiye"
    ]

    total_income = sum(t.get("amount", 0) for t in year_transactions if t.get("type") == "income")
    total_expense = sum(t.get("amount", 0) for t in year_transactions if t.get("type") == "expense")
    net_balance = total_income - total_expense

    # Also include any previous carryover balance in the year
    carryover_in_year = [
        t for t in all_transactions
        if t.get("date", "") >= year_start and t.get("date", "") <= year_end
        and t.get("category") == "Devir Bakiye"
    ]
    carryover_amount = sum(
        t.get("amount", 0) if t.get("type") == "income" else -t.get("amount", 0)
        for t in carryover_in_year
    )

    transfer_balance = net_balance + carryover_amount

    # Create carryover transaction for Jan 1 of next year
    next_year = year + 1
    transfer_date = f"{next_year}-01-01"
    transaction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    tx_type = "income" if transfer_balance >= 0 else "expense"
    tx_amount = abs(transfer_balance)

    transaction_doc = {
        "id": transaction_id,
        "type": tx_type,
        "category": "Devir Bakiye",
        "description": f"{year} yili devir bakiyesi",
        "amount": tx_amount,
        "date": transfer_date,
        "car_id": None,
        "employee_name": None,
        "user_id": current_user["user_id"],
        "org_id": org_id,
        "created_by": current_user["user_id"],
        "deleted": False,
        "deleted_at": None,
        "created_at": now
    }
    await db.transactions.insert_one(transaction_doc)

    # Record the transfer
    transfer_doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "year": year,
        "total_income": total_income,
        "total_expense": total_expense,
        "previous_carryover": carryover_amount,
        "net_balance": transfer_balance,
        "transfer_type": tx_type,
        "transfer_amount": tx_amount,
        "transaction_id": transaction_id,
        "created_by": current_user["user_id"],
        "created_at": now
    }
    await db.year_end_transfers.insert_one(transfer_doc)

    transfer_doc.pop("_id", None)
    return transfer_doc
