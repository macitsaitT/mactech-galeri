# Iter64: auto founding fill (legacy accounts) + non-vehicle income added to profit/equity
import os
import pytest
import requests
from datetime import date
from pymongo import MongoClient

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
EMAIL, PWD = "test_branch_6b287ede@test.com", "Password123!"


def _env(key):
    for line in open("/app/backend/.env"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')


mdb = MongoClient(_env("MONGO_URL"))[_env("DB_NAME")]


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    r = ses.post(f"{BASE}/api/auth/login", json={"email": EMAIL, "password": PWD})
    assert r.status_code == 200
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        ses.headers["Authorization"] = f"Bearer {tok}"
    return ses


@pytest.fixture(scope="module")
def org_id(s):
    me = s.get(f"{BASE}/api/auth/me").json()
    return me.get("org_id") or me.get("user_id")


def summ(s, **params):
    r = s.get(f"{BASE}/api/finance/summary", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def add_tx(s, category, amount, typ="income"):
    r = s.post(f"{BASE}/api/transactions", json={
        "type": typ, "category": category, "description": f"TEST_iter64 {category}",
        "amount": amount, "date": date.today().isoformat()})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def del_tx(s, tid):
    r = s.delete(f"{BASE}/api/transactions/{tid}?permanent=true")
    assert r.status_code in (200, 204), r.text


# Baseline state
def test_baseline(s):
    d = summ(s)
    print({k: d[k] for k in ("founding_capital", "cash_balance", "stock_value", "total_assets", "current_equity", "net_profit", "founding_auto", "other_income_all_time")})
    assert d["founding_auto"] is True
    assert d["founding_capital"] == 1005000
    assert d["cash_balance"] == 145000
    assert d["total_assets"] == 1245000
    assert d["current_equity"] == 1245000
    assert d["net_profit"] == 240000


# Legacy account simulation -> auto fill, persistent
def test_legacy_auto_fill(s, org_id):
    mdb.org_settings.update_one({"org_id": org_id}, {"$set": {"founding_capital": 0},
                                                     "$unset": {"founding_defined": "", "founding_auto": ""}})
    d = summ(s)
    retained = d["total_net_profit_all_time"] + d["other_income_all_time"] - d["total_operating_all_time"]
    assert d["founding_capital"] == round(d["total_assets"] - retained, 2)
    assert d["current_equity"] == d["total_assets"]
    assert d["founding_auto"] is True
    doc = mdb.org_settings.find_one({"org_id": org_id})
    assert doc["founding_defined"] is True and doc["founding_auto"] is True
    d2 = summ(s)
    assert d2["founding_capital"] == d["founding_capital"]
    assert d2["founding_auto"] is True


# Komisyon income -> profit/equity/cash, founding unchanged; then delete
def test_commission_income(s):
    b = summ(s)
    tid = add_tx(s, "Komisyon", 20000)
    try:
        a = summ(s)
        assert a["cash_balance"] == b["cash_balance"] + 20000
        assert a["total_assets"] == b["total_assets"] + 20000
        assert a["current_equity"] == b["current_equity"] + 20000
        assert a["net_profit"] == b["net_profit"] + 20000
        assert a["other_income_period"] == b["other_income_period"] + 20000
        assert a["founding_capital"] == b["founding_capital"]
        today = date.today().isoformat()
        p = summ(s, start_date=today, end_date=today)
        assert p["other_income_period"] >= 20000
    finally:
        del_tx(s, tid)
    c = summ(s)
    for k in ("cash_balance", "total_assets", "current_equity", "net_profit", "founding_capital"):
        assert c[k] == b[k], k


# Kapora income must not count as profit
def test_kapora_not_profit(s):
    b = summ(s)
    tid = add_tx(s, "Kapora", 5000)
    try:
        a = summ(s)
        assert a["net_profit"] == b["net_profit"]
        assert a["other_income_all_time"] == b["other_income_all_time"]
        print("kapora cash delta", a["cash_balance"] - b["cash_balance"], "equity delta", a["current_equity"] - b["current_equity"])
    finally:
        del_tx(s, tid)
    assert summ(s)["cash_balance"] == b["cash_balance"]


# Capital increase -> founding_auto false, +100k; delete reverts
def test_capital_increase(s, org_id):
    b = summ(s)
    r = s.post(f"{BASE}/api/capital/founding/adjust", json={"amount": 100000, "type": "increase"})
    assert r.status_code == 200, r.text
    a = summ(s)
    assert a["founding_auto"] is False
    for k in ("founding_capital", "cash_balance", "current_equity", "total_assets"):
        assert a[k] == b[k] + 100000, k
    assert a["net_profit"] == b["net_profit"]
    assert a["other_income_all_time"] == b["other_income_all_time"]
    txs = [t for t in s.get(f"{BASE}/api/transactions").json() if t.get("category") == "Sermaye Artırımı"]
    assert txs
    for t in txs:
        del_tx(s, t["id"])
    c = summ(s)
    for k in ("founding_capital", "cash_balance", "current_equity", "total_assets", "net_profit"):
        assert c[k] == b[k], k
    # restore baseline flag
    mdb.org_settings.update_one({"org_id": org_id}, {"$set": {"founding_capital": 1005000, "founding_defined": True, "founding_auto": True}})
    assert summ(s)["founding_auto"] is True
