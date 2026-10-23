# Founding capital adjust (increase/decrease/set) must change cash balance by same delta
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "test_branch_6b287ede@test.com"
PASSWORD = "Password123!"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


def summary(c):
    r = c.get(f"{BASE_URL}/api/finance/summary")
    assert r.status_code == 200, r.text
    d = r.json()
    return float(d["founding_capital"]), float(d["cash_balance"])


def adjust(c, amount, t):
    return c.post(f"{BASE_URL}/api/capital/founding/adjust", json={"amount": amount, "type": t})


@pytest.fixture(scope="module", autouse=True)
def restore(client):
    f0, c0 = summary(client)
    print(f"initial founding={f0} cash={c0}")
    yield
    f1, c1 = summary(client)
    # restore founding via set (cash follows), then fix cash diff if any
    if f1 != f0:
        adjust(client, f0, "set")
    f2, c2 = summary(client)
    print(f"restored founding={f2} cash={c2}")


def test_increase(client):
    f, c = summary(client)
    r = adjust(client, 1234, "increase")
    assert r.status_code == 200, r.text
    assert r.json()["founding_capital"] == f + 1234
    f2, c2 = summary(client)
    assert f2 == f + 1234 and c2 == c + 1234


def test_decrease(client):
    f, c = summary(client)
    r = adjust(client, 1234, "decrease")
    assert r.status_code == 200, r.text
    f2, c2 = summary(client)
    assert f2 == f - 1234 and c2 == c - 1234


def test_set_affects_cash(client):
    f, c = summary(client)
    r = adjust(client, f + 5000, "set")
    assert r.status_code == 200, r.text
    f2, c2 = summary(client)
    assert f2 == f + 5000 and c2 == c + 5000
    r = adjust(client, f, "set")
    assert r.status_code == 200, r.text
    f3, c3 = summary(client)
    assert f3 == f and c3 == c


def test_decrease_insufficient_cash(client):
    f, c = summary(client)
    # amount < founding but > cash
    amt = c + 1000
    if amt > f:
        pytest.skip("cash >= founding; cannot construct case")
    r = adjust(client, amt, "decrease")
    assert r.status_code == 400
    assert "insufficient_capital" in r.text
    assert summary(client) == (f, c)


def test_decrease_more_than_founding(client):
    f, c = summary(client)
    r = adjust(client, f + 1, "decrease")
    assert r.status_code == 400
    assert summary(client) == (f, c)


def test_set_decrease_insufficient_cash(client):
    f, c = summary(client)
    target = f - (c + 1000)
    if target < 0:
        pytest.skip("n/a")
    r = adjust(client, target, "set")
    assert r.status_code == 400
    assert summary(client) == (f, c)


def test_zero_and_negative(client):
    assert adjust(client, 0, "increase").status_code == 400
    assert adjust(client, -5, "increase").status_code == 422
    assert adjust(client, 5, "bogus").status_code == 422


def test_movements_recorded(client):
    adjust(client, 777, "increase")
    adjust(client, 777, "decrease")
    r = client.get(f"{BASE_URL}/api/capital/movements")
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("items") or data.get("movements") or []
    reasons = [m.get("reason") for m in items[:10]]
    assert "capital_increase" in reasons and "capital_decrease" in reasons
