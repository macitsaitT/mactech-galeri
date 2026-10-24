# Iter63: First founding definition (legacy account, founding=0) must NOT double cash; subsequent adjust changes everything; restore re-applies
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "test_branch_6b287ede@test.com"
PASSWORD = "Password123!"
CAP_CATS = ("Sermaye Artırımı", "Sermaye Azaltımı")


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        sess.headers.update({"Authorization": f"Bearer {tok}"})
    yield sess
    # Cleanup: permanently delete TEST_ capital txs and restore founding
    txs = sess.get(f"{BASE_URL}/api/transactions").json()
    for t in txs:
        if t.get("category") in CAP_CATS and "TEST_" in (t.get("description") or ""):
            sess.delete(f"{BASE_URL}/api/transactions/{t['id']}?permanent=true")
    sess.put(f"{BASE_URL}/api/capital/founding", json={"amount": 10_000_000})


def summary(s):
    r = s.get(f"{BASE_URL}/api/finance/summary")
    assert r.status_code == 200
    return r.json()


def cap_txs(s):
    return [t for t in s.get(f"{BASE_URL}/api/transactions").json() if t.get("category") in CAP_CATS]


def adjust(s, typ, amount, desc=""):
    r = s.post(f"{BASE_URL}/api/capital/founding/adjust", json={"type": typ, "amount": amount, "description": desc})
    assert r.status_code == 200, r.text
    return r.json()


def test_baseline(s):
    sm = summary(s)
    print("baseline", {k: sm.get(k) for k in ("founding_capital", "cash_balance", "current_equity", "total_assets", "net_profit")})
    assert sm["founding_capital"] == 10_000_000
    assert sm["cash_balance"] == 145_000


# Initial definition via set: no cash change, no tx
def test_initial_set_no_double_cash(s):
    r = s.put(f"{BASE_URL}/api/capital/founding", json={"amount": 0})
    assert r.status_code == 200
    z = summary(s)
    assert z["founding_capital"] == 0
    n_before = len(cap_txs(s))
    res = adjust(s, "set", 10_000_000, "TEST_initial_set")
    assert res.get("initial") is True and res["founding_capital"] == 10_000_000
    a = summary(s)
    assert a["founding_capital"] == 10_000_000
    assert a["cash_balance"] == z["cash_balance"] == 145_000
    assert a["total_assets"] == z["total_assets"]
    assert a["current_equity"] == 10_240_000, a["current_equity"]
    assert len(cap_txs(s)) == n_before


# Initial definition via increase: also no cash change
def test_initial_increase_no_double_cash(s):
    s.put(f"{BASE_URL}/api/capital/founding", json={"amount": 0})
    z = summary(s)
    res = adjust(s, "increase", 10_000_000, "TEST_initial_inc")
    assert res.get("initial") is True
    a = summary(s)
    assert a["founding_capital"] == 10_000_000
    assert a["cash_balance"] == z["cash_balance"]
    assert [t for t in cap_txs(s) if t.get("description") == "TEST_initial_inc"] == []


# Decrease on founding=0 rejected
def test_decrease_on_zero_rejected(s):
    s.put(f"{BASE_URL}/api/capital/founding", json={"amount": 0})
    r = s.post(f"{BASE_URL}/api/capital/founding/adjust", json={"type": "decrease", "amount": 1000})
    assert r.status_code == 400
    s.put(f"{BASE_URL}/api/capital/founding", json={"amount": 10_000_000})
    assert summary(s)["founding_capital"] == 10_000_000


# Subsequent increase/decrease change everything
def test_subsequent_increase_decrease(s):
    b = summary(s)
    adjust(s, "increase", 100000, "TEST_inc_after_init")
    a = summary(s)
    assert a["founding_capital"] == 10_100_000
    assert a["cash_balance"] == 245_000
    assert a["current_equity"] - b["current_equity"] == 100000
    assert a["total_assets"] - b["total_assets"] == 100000
    assert a["net_profit"] == b["net_profit"]
    assert len([t for t in cap_txs(s) if t["description"] == "TEST_inc_after_init"]) == 1
    adjust(s, "decrease", 100000, "TEST_dec_after_init")
    c = summary(s)
    assert c["founding_capital"] == b["founding_capital"]
    assert c["cash_balance"] == b["cash_balance"]
    assert c["current_equity"] == b["current_equity"]
    assert c["total_assets"] == b["total_assets"]
    for t in cap_txs(s):
        if t["description"] in ("TEST_inc_after_init", "TEST_dec_after_init"):
            s.delete(f"{BASE_URL}/api/transactions/{t['id']}?permanent=true")
    # permanent delete of inc and dec cancels out
    d = summary(s)
    assert d["founding_capital"] == b["founding_capital"] and d["cash_balance"] == b["cash_balance"]


# Soft delete -> restore re-applies cash and founding
def test_soft_delete_restore(s):
    b = summary(s)
    adjust(s, "increase", 10000, "TEST_restore_10k")
    tx = [t for t in cap_txs(s) if t["description"] == "TEST_restore_10k"][0]
    s.delete(f"{BASE_URL}/api/transactions/{tx['id']}")
    m = summary(s)
    assert m["founding_capital"] == b["founding_capital"] and m["cash_balance"] == b["cash_balance"]
    r = s.post(f"{BASE_URL}/api/transactions/{tx['id']}/restore")
    assert r.status_code == 200
    a = summary(s)
    try:
        assert a["cash_balance"] - b["cash_balance"] == 10000
        assert a["founding_capital"] - b["founding_capital"] == 10000
        # restore twice must not double-apply
        s.post(f"{BASE_URL}/api/transactions/{tx['id']}/restore")
        a2 = summary(s)
        assert a2["cash_balance"] == a["cash_balance"] and a2["founding_capital"] == a["founding_capital"]
    finally:
        s.delete(f"{BASE_URL}/api/transactions/{tx['id']}?permanent=true")
    f = summary(s)
    assert f["founding_capital"] == b["founding_capital"] and f["cash_balance"] == b["cash_balance"]


# Non-capital tx restore also re-applies cash
def test_restore_regular_expense(s):
    b = summary(s)
    r = s.post(f"{BASE_URL}/api/transactions", json={"type": "expense", "category": "Diğer", "amount": 5000,
                                                     "description": "TEST_restore_exp", "date": "2026-01-10"})
    assert r.status_code in (200, 201), r.text
    tid = r.json()["id"]
    try:
        assert summary(s)["cash_balance"] == b["cash_balance"] - 5000
        s.delete(f"{BASE_URL}/api/transactions/{tid}")
        assert summary(s)["cash_balance"] == b["cash_balance"]
        s.post(f"{BASE_URL}/api/transactions/{tid}/restore")
        assert summary(s)["cash_balance"] == b["cash_balance"] - 5000
        assert summary(s)["founding_capital"] == b["founding_capital"]
    finally:
        s.delete(f"{BASE_URL}/api/transactions/{tid}?permanent=true")
    assert summary(s)["cash_balance"] == b["cash_balance"]


def test_final_state(s):
    sm = summary(s)
    assert sm["founding_capital"] == 10_000_000
    assert sm["cash_balance"] == 145_000
