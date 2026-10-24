# Helper: cleanup capital txs / set founding for iter63 UI tests. usage: python iter63_helper.py [cleanup|zero|state]
import os, sys, requests
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
s = requests.Session()
r = s.post(f"{BASE}/api/auth/login", json={"email": "test_branch_6b287ede@test.com", "password": "Password123!"})
tok = r.json().get("token") or r.json().get("access_token")
if tok:
    s.headers["Authorization"] = f"Bearer {tok}"
cmd = sys.argv[1] if len(sys.argv) > 1 else "state"
if cmd == "cleanup":
    for t in s.get(f"{BASE}/api/transactions").json():
        if t.get("category") in ("Sermaye Artırımı", "Sermaye Azaltımı"):
            print("del", t["description"], s.delete(f"{BASE}/api/transactions/{t['id']}?permanent=true").status_code)
    print(s.put(f"{BASE}/api/capital/founding", json={"amount": 10_000_000}).status_code)
elif cmd == "zero":
    print(s.put(f"{BASE}/api/capital/founding", json={"amount": 0}).status_code)
sm = s.get(f"{BASE}/api/finance/summary").json()
print({k: sm.get(k) for k in ("founding_capital", "cash_balance", "current_equity", "total_assets")})
print("capital txs:", [(t["category"], t["amount"]) for t in s.get(f"{BASE}/api/transactions").json() if t.get("category", "").startswith("Sermaye")])
