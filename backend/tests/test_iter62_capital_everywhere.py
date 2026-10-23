# Iter62: Founding capital adjust -> creates Sermaye Artırımı/Azaltımı transactions, neutral for P&L, revert on delete
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "test_branch_6b287ede@test.com"
PASSWORD = "Password123!"


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
    # Cleanup: permanently delete any leftover capital txs created by tests
    txs = sess.get(f"{BASE_URL}/api/transactions").json()
    for t in txs:
        if t.get("category") in ("Sermaye Artırımı", "Sermaye Azaltımı") and "TEST_" in (t.get("description") or ""):
            sess.delete(f"{BASE_URL}/api/transactions/{t['id']}?permanent=true")


def summary(s):
    r = s.get(f"{BASE_URL}/api/finance/summary")
    assert r.status_code == 200
    return r.json()


def find_tx(s, desc):
    txs = s.get(f"{BASE_URL}/api/transactions").json()
    return [t for t in txs if t.get("description") == desc]


def adjust(s, typ, amount, desc):
    r = s.post(f"{BASE_URL}/api/capital/founding/adjust", json={"type": typ, "amount": amount, "description": desc})
    assert r.status_code == 200, r.text
    return r.json()


# Baseline check
def test_baseline(s):
    sm = summary(s)
    print("baseline", sm["founding_capital"], sm["cash_balance"], sm.get("operating_expense_period"), sm.get("net_profit"))
    assert sm["founding_capital"] == 10_000_000
    assert sm["cash_balance"] == 145_000


# Increase -> income tx + summary deltas; neutral to P&L
def test_increase_creates_income_tx_and_is_neutral(s):
    b = summary(s)
    adjust(s, "increase", 100000, "TEST_inc_100k")
    a = summary(s)
    assert a["founding_capital"] - b["founding_capital"] == 100000
    assert a["cash_balance"] - b["cash_balance"] == 100000
    assert a["current_equity"] - b["current_equity"] == 100000
    assert a["total_assets"] - b["total_assets"] == 100000
    assert a["operating_expense_period"] == b["operating_expense_period"]
    assert a["net_profit"] == b["net_profit"]
    txs = find_tx(s, "TEST_inc_100k")
    assert len(txs) == 1
    assert txs[0]["type"] == "income" and txs[0]["category"] == "Sermaye Artırımı" and txs[0]["amount"] == 100000
    # cleanup via permanent delete -> reverts founding and cash
    r = s.delete(f"{BASE_URL}/api/transactions/{txs[0]['id']}?permanent=true")
    assert r.status_code == 200
    c = summary(s)
    assert c["founding_capital"] == b["founding_capital"]
    assert c["cash_balance"] == b["cash_balance"]
    assert find_tx(s, "TEST_inc_100k") == []


# Decrease -> expense tx, neutral; delete reverts
def test_decrease_creates_expense_tx_and_is_neutral(s):
    b = summary(s)
    adjust(s, "decrease", 30000, "TEST_dec_30k")
    a = summary(s)
    assert b["founding_capital"] - a["founding_capital"] == 30000
    assert b["cash_balance"] - a["cash_balance"] == 30000
    assert a["operating_expense_period"] == b["operating_expense_period"]
    assert a["net_profit"] == b["net_profit"]
    txs = find_tx(s, "TEST_dec_30k")
    assert len(txs) == 1 and txs[0]["type"] == "expense" and txs[0]["category"] == "Sermaye Azaltımı"
    s.delete(f"{BASE_URL}/api/transactions/{txs[0]['id']}?permanent=true")
    c = summary(s)
    assert c["founding_capital"] == b["founding_capital"] and c["cash_balance"] == b["cash_balance"]


# Set mode -> diff tx
def test_set_mode_creates_diff_tx(s):
    b = summary(s)
    target = b["founding_capital"] + 50000
    r = adjust(s, "set", target, "TEST_set_plus50k")
    assert r["founding_capital"] == target
    txs = find_tx(s, "TEST_set_plus50k")
    assert len(txs) == 1 and txs[0]["amount"] == 50000 and txs[0]["category"] == "Sermaye Artırımı"
    a = summary(s)
    assert a["cash_balance"] - b["cash_balance"] == 50000
    s.delete(f"{BASE_URL}/api/transactions/{txs[0]['id']}?permanent=true")
    # set to same value -> no tx
    adjust(s, "set", b["founding_capital"], "TEST_set_same")
    assert find_tx(s, "TEST_set_same") == []
    c = summary(s)
    assert c["founding_capital"] == b["founding_capital"] and c["cash_balance"] == b["cash_balance"]


# Delete via capital movement -> reverts both
def test_delete_movement_reverts_both(s):
    b = summary(s)
    adjust(s, "increase", 20000, "TEST_mv_20k")
    tx = find_tx(s, "TEST_mv_20k")[0]
    mvs = s.get(f"{BASE_URL}/api/capital/movements").json()["movements"]
    mv = [m for m in mvs if m.get("ref_id") == tx["id"]]
    assert mv and mv[0]["reason"] == "capital_increase"
    r = s.delete(f"{BASE_URL}/api/capital/movements/{mv[0]['id']}")
    assert r.status_code == 200 and r.json()["transaction_removed"] is True
    c = summary(s)
    assert c["founding_capital"] == b["founding_capital"] and c["cash_balance"] == b["cash_balance"]
    assert find_tx(s, "TEST_mv_20k") == []


# Soft delete -> restore should re-apply both cash and founding
def test_soft_delete_then_restore(s):
    b = summary(s)
    adjust(s, "increase", 10000, "TEST_restore_10k")
    tx = find_tx(s, "TEST_restore_10k")[0]
    s.delete(f"{BASE_URL}/api/transactions/{tx['id']}")
    m = summary(s)
    assert m["founding_capital"] == b["founding_capital"] and m["cash_balance"] == b["cash_balance"]
    r = s.post(f"{BASE_URL}/api/transactions/{tx['id']}/restore")
    assert r.status_code == 200
    a = summary(s)
    try:
        assert a["cash_balance"] - b["cash_balance"] == 10000, f"restore cash delta {a['cash_balance'] - b['cash_balance']}"
        assert a["founding_capital"] - b["founding_capital"] == 10000, f"restore founding delta {a['founding_capital'] - b['founding_capital']}"
    finally:
        s.delete(f"{BASE_URL}/api/transactions/{tx['id']}?permanent=true")
        f = summary(s)
        print("after restore cleanup", f["founding_capital"], f["cash_balance"])


# Final state check
def test_final_state(s):
    sm = summary(s)
    assert sm["founding_capital"] == 10_000_000
    assert sm["cash_balance"] == 145_000
