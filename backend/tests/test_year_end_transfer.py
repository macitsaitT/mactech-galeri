"""
Test Year-End Transfer (Yıl Sonu Devri) Feature
Tests:
- POST /api/year-end-transfer - create year-end carryover (admin only)
- GET /api/year-end-transfers - list transfer history (admin only)
- Duplicate transfer rejection for same year
- Non-admin users should get 403 error
- Transfer creates correct 'Devir Bakiye' transaction type
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestYearEndTransfer:
    """Year-End Transfer API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and authentication"""
        self.unique_id = str(uuid.uuid4())[:8]
        self.admin_email = f"test_yearend_admin_{self.unique_id}@test.com"
        self.admin_password = "password123"
        self.admin_token = None
        self.test_transactions = []
        
        # Register admin user
        register_resp = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": self.admin_email,
                "password": self.admin_password,
                "company_name": "Year End Test Co"
            }
        )
        
        if register_resp.status_code == 201:
            data = register_resp.json()
            self.admin_token = data.get("token")
        elif register_resp.status_code == 429:
            # Rate limited, try login instead
            login_resp = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": self.admin_email, "password": self.admin_password}
            )
            if login_resp.status_code == 200:
                self.admin_token = login_resp.json().get("token")
        
        if not self.admin_token:
            pytest.skip("Could not authenticate admin user")
        
        yield
        
        # Cleanup: No explicit cleanup needed due to org_id isolation
    
    def get_admin_headers(self):
        return {"Authorization": f"Bearer {self.admin_token}"}
    
    def create_test_transaction(self, tx_type, category, amount, date, description=None):
        """Helper to create test transaction"""
        tx_data = {
            "type": tx_type,
            "category": category,
            "amount": amount,
            "date": date,
            "description": description or f"Test transaction {self.unique_id}"
        }
        resp = requests.post(
            f"{BASE_URL}/api/transactions",
            headers=self.get_admin_headers(),
            json=tx_data
        )
        if resp.status_code == 201:
            self.test_transactions.append(resp.json())
        return resp
    
    # ==================== GET /api/year-end-transfers Tests ====================
    
    def test_get_year_end_transfers_success(self):
        """GET /api/year-end-transfers should return list for admin"""
        resp = requests.get(
            f"{BASE_URL}/api/year-end-transfers",
            headers=self.get_admin_headers()
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        print("SUCCESS: GET /api/year-end-transfers returns list")
    
    def test_get_year_end_transfers_no_auth(self):
        """GET /api/year-end-transfers without token should fail"""
        resp = requests.get(f"{BASE_URL}/api/year-end-transfers")
        
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("SUCCESS: GET /api/year-end-transfers without auth returns 401")
    
    # ==================== POST /api/year-end-transfer Tests ====================
    
    def test_create_year_end_transfer_success(self):
        """POST /api/year-end-transfer should create transfer for admin"""
        # First create some test transactions for a specific year
        test_year = 2022  # Use a past year unlikely to have existing transfers
        
        # Create income transaction
        self.create_test_transaction("income", "Araç Satışı", 50000, f"{test_year}-06-15")
        # Create expense transaction
        self.create_test_transaction("expense", "Araç Alımı", 30000, f"{test_year}-03-10")
        
        # Create year-end transfer
        resp = requests.post(
            f"{BASE_URL}/api/year-end-transfer",
            headers=self.get_admin_headers(),
            json={"year": test_year}
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "id" in data, "Response should contain id"
        assert "year" in data, "Response should contain year"
        assert data["year"] == test_year, f"Year should be {test_year}"
        assert "total_income" in data, "Response should contain total_income"
        assert "total_expense" in data, "Response should contain total_expense"
        assert "net_balance" in data, "Response should contain net_balance"
        assert "transfer_type" in data, "Response should contain transfer_type"
        assert "transfer_amount" in data, "Response should contain transfer_amount"
        assert "transaction_id" in data, "Response should contain transaction_id"
        
        # Verify balance calculation
        expected_net = data["total_income"] - data["total_expense"] + data.get("previous_carryover", 0)
        assert data["net_balance"] == expected_net, "Net balance calculation incorrect"
        
        # Transfer type should be income if positive, expense if negative
        if data["net_balance"] >= 0:
            assert data["transfer_type"] == "income", "Transfer type should be income for positive balance"
        else:
            assert data["transfer_type"] == "expense", "Transfer type should be expense for negative balance"
        
        print(f"SUCCESS: Year-end transfer created for {test_year}")
        print(f"  Income: {data['total_income']}, Expense: {data['total_expense']}, Net: {data['net_balance']}")
    
    def test_create_year_end_transfer_duplicate_rejected(self):
        """POST /api/year-end-transfer should reject duplicate for same year"""
        test_year = 2021  # Use a different past year
        
        # First create a transfer
        first_resp = requests.post(
            f"{BASE_URL}/api/year-end-transfer",
            headers=self.get_admin_headers(),
            json={"year": test_year}
        )
        
        if first_resp.status_code != 200:
            # Already exists from previous run, try the duplicate test
            pass
        
        # Try to create duplicate
        dup_resp = requests.post(
            f"{BASE_URL}/api/year-end-transfer",
            headers=self.get_admin_headers(),
            json={"year": test_year}
        )
        
        assert dup_resp.status_code == 400, f"Expected 400 for duplicate, got {dup_resp.status_code}"
        error_detail = dup_resp.json().get("detail", "")
        assert "zaten" in error_detail.lower() or "devir" in error_detail.lower(), \
            f"Error should mention already done: {error_detail}"
        print(f"SUCCESS: Duplicate transfer for {test_year} correctly rejected")
    
    def test_create_year_end_transfer_invalid_year(self):
        """POST /api/year-end-transfer should reject invalid year"""
        resp = requests.post(
            f"{BASE_URL}/api/year-end-transfer",
            headers=self.get_admin_headers(),
            json={"year": "not_a_number"}
        )
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print("SUCCESS: Invalid year correctly rejected")
    
    def test_create_year_end_transfer_missing_year(self):
        """POST /api/year-end-transfer should reject missing year"""
        resp = requests.post(
            f"{BASE_URL}/api/year-end-transfer",
            headers=self.get_admin_headers(),
            json={}
        )
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print("SUCCESS: Missing year correctly rejected")
    
    def test_create_year_end_transfer_no_auth(self):
        """POST /api/year-end-transfer without token should fail"""
        resp = requests.post(
            f"{BASE_URL}/api/year-end-transfer",
            json={"year": 2020}
        )
        
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("SUCCESS: POST /api/year-end-transfer without auth returns 401")
    
    # ==================== Verify Transaction Created ====================
    
    def test_verify_devir_transaction_created(self):
        """Verify the carryover transaction is created with correct date and type"""
        test_year = 2019  # Use another past year
        
        # Create some income for this year
        self.create_test_transaction("income", "Test Income", 10000, f"{test_year}-08-20")
        
        # Create year-end transfer
        transfer_resp = requests.post(
            f"{BASE_URL}/api/year-end-transfer",
            headers=self.get_admin_headers(),
            json={"year": test_year}
        )
        
        if transfer_resp.status_code == 400:
            # Already done, skip verification
            print("INFO: Year 2019 transfer already exists, skipping verification")
            return
        
        assert transfer_resp.status_code == 200, f"Expected 200, got {transfer_resp.status_code}"
        transfer_data = transfer_resp.json()
        transaction_id = transfer_data.get("transaction_id")
        
        # Fetch all transactions and find the created one
        txs_resp = requests.get(
            f"{BASE_URL}/api/transactions",
            headers=self.get_admin_headers()
        )
        assert txs_resp.status_code == 200
        
        transactions = txs_resp.json()
        devir_tx = next((t for t in transactions if t.get("id") == transaction_id), None)
        
        assert devir_tx is not None, "Devir transaction should be created"
        assert devir_tx["category"] == "Devir Bakiye", "Category should be 'Devir Bakiye'"
        assert devir_tx["date"] == f"{test_year + 1}-01-01", f"Date should be Jan 1 of next year ({test_year + 1})"
        
        # Type should match net balance
        if transfer_data["net_balance"] >= 0:
            assert devir_tx["type"] == "income", "Type should be income for positive balance"
        else:
            assert devir_tx["type"] == "expense", "Type should be expense for negative balance"
        
        assert devir_tx["amount"] == abs(transfer_data["net_balance"]), "Amount should be absolute value of net balance"
        
        print(f"SUCCESS: Devir transaction verified for {test_year}")
        print(f"  Transaction date: {devir_tx['date']}, type: {devir_tx['type']}, amount: {devir_tx['amount']}")


class TestYearEndTransferNonAdmin:
    """Test that non-admin users cannot access year-end transfer features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin and non-admin users"""
        self.unique_id = str(uuid.uuid4())[:8]
        
        # Register admin user first
        admin_email = f"test_ye_admin2_{self.unique_id}@test.com"
        admin_password = "password123"
        
        admin_reg = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": admin_email,
                "password": admin_password,
                "company_name": "Year End Test 2"
            }
        )
        
        if admin_reg.status_code != 201:
            pytest.skip("Could not register admin user (rate limited)")
        
        self.admin_token = admin_reg.json().get("token")
        
        # Create a non-admin user under this org
        nonadmin_email = f"test_ye_user_{self.unique_id}@test.com"
        nonadmin_password = "password123"
        
        user_resp = requests.post(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "email": nonadmin_email,
                "password": nonadmin_password,
                "name": "Test User",
                "role": "muhasebe"
            }
        )
        
        if user_resp.status_code != 201:
            pytest.skip("Could not create non-admin user")
        
        # Login as non-admin
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": nonadmin_email, "password": nonadmin_password}
        )
        
        if login_resp.status_code != 200:
            pytest.skip("Could not login as non-admin user")
        
        self.nonadmin_token = login_resp.json().get("token")
        yield
    
    def test_nonadmin_cannot_get_transfers(self):
        """Non-admin should get 403 when accessing GET /api/year-end-transfers"""
        resp = requests.get(
            f"{BASE_URL}/api/year-end-transfers",
            headers={"Authorization": f"Bearer {self.nonadmin_token}"}
        )
        
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        print("SUCCESS: Non-admin correctly rejected from GET /api/year-end-transfers (403)")
    
    def test_nonadmin_cannot_create_transfer(self):
        """Non-admin should get 403 when trying POST /api/year-end-transfer"""
        resp = requests.post(
            f"{BASE_URL}/api/year-end-transfer",
            headers={"Authorization": f"Bearer {self.nonadmin_token}"},
            json={"year": 2018}
        )
        
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        print("SUCCESS: Non-admin correctly rejected from POST /api/year-end-transfer (403)")


class TestYearEndTransferHistory:
    """Test transfer history is correctly stored and retrieved"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.unique_id = str(uuid.uuid4())[:8]
        admin_email = f"test_ye_hist_{self.unique_id}@test.com"
        admin_password = "password123"
        
        reg_resp = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": admin_email,
                "password": admin_password,
                "company_name": "History Test Co"
            }
        )
        
        if reg_resp.status_code != 201:
            pytest.skip("Could not register (rate limited)")
        
        self.admin_token = reg_resp.json().get("token")
        yield
    
    def test_transfer_history_includes_all_fields(self):
        """Verify transfer history record contains all required fields"""
        test_year = 2017
        
        # Create transfer
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Add a transaction first
        requests.post(
            f"{BASE_URL}/api/transactions",
            headers=headers,
            json={
                "type": "income",
                "category": "Test",
                "amount": 5000,
                "date": f"{test_year}-05-10"
            }
        )
        
        transfer_resp = requests.post(
            f"{BASE_URL}/api/year-end-transfer",
            headers=headers,
            json={"year": test_year}
        )
        
        if transfer_resp.status_code == 400:
            # Already exists, just fetch history
            pass
        
        # Get transfer history
        history_resp = requests.get(
            f"{BASE_URL}/api/year-end-transfers",
            headers=headers
        )
        
        assert history_resp.status_code == 200
        history = history_resp.json()
        assert len(history) > 0, "Should have at least one transfer in history"
        
        # Check first record has all fields
        record = history[0]
        required_fields = [
            "id", "year", "total_income", "total_expense",
            "net_balance", "transfer_type", "transfer_amount",
            "transaction_id", "created_at"
        ]
        
        for field in required_fields:
            assert field in record, f"History record should contain {field}"
        
        print(f"SUCCESS: Transfer history contains all required fields")
        print(f"  History has {len(history)} record(s)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
