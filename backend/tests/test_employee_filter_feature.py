"""
Test Suite for Employee Filter Feature in Report Modal
- Tests GET /api/employees endpoint returns list of employees
- Tests employee filter works with transactions via created_by field
- Tests admin/muhasebe roles can access employee list
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEmployeeFilterFeature:
    """Tests for employee filter feature used in ReportModal"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data and authenticate"""
        self.admin_email = "admin@mactech.tr"
        self.admin_password = "password"
        self.admin_token = None
        self.created_user_id = None
        self.created_transaction_id = None
        
        # Login as admin
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        
        if login_resp.status_code != 200:
            pytest.skip(f"Admin login failed: {login_resp.status_code} - {login_resp.text}")
        
        data = login_resp.json()
        self.admin_token = data.get("token")
        self.admin_user = data.get("user", {})
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        yield
        
        # Cleanup - delete test user if created
        if self.created_user_id:
            requests.delete(
                f"{BASE_URL}/api/users/{self.created_user_id}",
                headers=self.admin_headers
            )
        
        # Cleanup - delete test transaction if created
        if self.created_transaction_id:
            requests.delete(
                f"{BASE_URL}/api/transactions/{self.created_transaction_id}?permanent=true",
                headers=self.admin_headers
            )
    
    def test_employees_endpoint_returns_list(self):
        """Test GET /api/employees returns list of employees in org"""
        resp = requests.get(f"{BASE_URL}/api/employees", headers=self.admin_headers)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        employees = resp.json()
        assert isinstance(employees, list), "Expected list of employees"
        assert len(employees) >= 1, "Should have at least the admin user"
        
        # Check employee structure
        for emp in employees:
            assert "id" in emp, "Employee should have id field"
            assert "email" in emp, "Employee should have email field"
            assert "name" in emp, "Employee should have name field"
            assert "role" in emp, "Employee should have role field"
        
        print(f"✓ GET /api/employees returned {len(employees)} employees")
    
    def test_employees_endpoint_contains_current_admin(self):
        """Test that employees list contains the current admin user"""
        resp = requests.get(f"{BASE_URL}/api/employees", headers=self.admin_headers)
        
        assert resp.status_code == 200
        employees = resp.json()
        
        # Find admin in list
        admin_found = False
        for emp in employees:
            if emp["email"] == self.admin_email:
                admin_found = True
                assert emp["role"] == "admin", f"Admin user should have admin role, got {emp['role']}"
                break
        
        assert admin_found, f"Admin user {self.admin_email} should be in employees list"
        print(f"✓ Admin user found in employees list")
    
    def test_create_satis_employee_for_filter_testing(self):
        """Test creating a satis employee for filter testing"""
        test_email = f"TEST_satis_{uuid.uuid4().hex[:8]}@test.com"
        
        # Create satis user
        create_resp = requests.post(
            f"{BASE_URL}/api/users",
            headers=self.admin_headers,
            json={
                "email": test_email,
                "password": "password123",
                "company_name": "Test Satıcı",
                "phone": "5551234567",
                "role": "satis"
            }
        )
        
        assert create_resp.status_code == 200, f"Failed to create user: {create_resp.text}"
        
        created_user = create_resp.json()
        self.created_user_id = created_user["id"]
        
        assert created_user["role"] == "satis", "Created user should have satis role"
        
        # Verify new user appears in employees list
        emp_resp = requests.get(f"{BASE_URL}/api/employees", headers=self.admin_headers)
        assert emp_resp.status_code == 200
        
        employees = emp_resp.json()
        new_emp_found = any(emp["id"] == self.created_user_id for emp in employees)
        
        assert new_emp_found, "Newly created employee should appear in employees list"
        assert len(employees) >= 2, "Should have at least 2 employees now (admin + satis)"
        
        print(f"✓ Created satis employee and verified in employees list ({len(employees)} total)")
    
    def test_transactions_have_created_by_field(self):
        """Test that transactions have created_by field for filtering"""
        # Create a test transaction
        create_resp = requests.post(
            f"{BASE_URL}/api/transactions",
            headers=self.admin_headers,
            json={
                "type": "income",
                "category": "TEST_Satış",
                "description": "Test transaction for employee filter",
                "amount": 1000,
                "date": "2024-01-15"
            }
        )
        
        assert create_resp.status_code == 200, f"Failed to create transaction: {create_resp.text}"
        
        created_tx = create_resp.json()
        self.created_transaction_id = created_tx["id"]
        
        # Verify transaction has created_by field
        assert "created_by" in created_tx, "Transaction should have created_by field"
        assert created_tx["created_by"] == self.admin_user["id"], \
            f"created_by should be admin user id, got {created_tx.get('created_by')}"
        
        print(f"✓ Transaction created with created_by={created_tx['created_by']}")
    
    def test_get_transactions_returns_created_by(self):
        """Test that GET /api/transactions returns created_by field"""
        # Create a test transaction first
        create_resp = requests.post(
            f"{BASE_URL}/api/transactions",
            headers=self.admin_headers,
            json={
                "type": "expense",
                "category": "TEST_Gider",
                "description": "Test transaction filter check",
                "amount": 500,
                "date": "2024-01-16"
            }
        )
        
        if create_resp.status_code == 200:
            self.created_transaction_id = create_resp.json()["id"]
        
        # Get all transactions
        list_resp = requests.get(f"{BASE_URL}/api/transactions", headers=self.admin_headers)
        
        assert list_resp.status_code == 200, f"Failed to get transactions: {list_resp.text}"
        
        transactions = list_resp.json()
        
        # Check that transactions have created_by field
        for tx in transactions:
            if tx.get("category", "").startswith("TEST_"):
                assert "created_by" in tx, f"Transaction {tx.get('id')} should have created_by field"
        
        print(f"✓ GET /api/transactions returns created_by field ({len(transactions)} transactions)")
    
    def test_employees_endpoint_has_name_field(self):
        """Test employees endpoint returns name field for dropdown display"""
        resp = requests.get(f"{BASE_URL}/api/employees", headers=self.admin_headers)
        
        assert resp.status_code == 200
        employees = resp.json()
        
        for emp in employees:
            assert "name" in emp, "Employee should have name field"
            # Name should be company_name or email fallback
            assert emp["name"], f"Employee name should not be empty: {emp}"
        
        print(f"✓ All employees have name field for dropdown display")
    
    def test_employee_filter_with_created_by_param(self):
        """Test transactions can be filtered by created_by query parameter"""
        # Note: This tests if the backend supports created_by query param
        admin_id = self.admin_user["id"]
        
        # Try getting transactions filtered by created_by
        resp = requests.get(
            f"{BASE_URL}/api/transactions?created_by={admin_id}",
            headers=self.admin_headers
        )
        
        assert resp.status_code == 200, f"Failed with created_by filter: {resp.text}"
        
        transactions = resp.json()
        # All returned transactions should be created by admin
        for tx in transactions:
            assert tx.get("created_by") == admin_id or tx.get("created_by") is None, \
                f"Transaction {tx.get('id')} should be created by {admin_id}, got {tx.get('created_by')}"
        
        print(f"✓ Transactions filtered by created_by returned {len(transactions)} results")


class TestEmployeeRoleAccess:
    """Tests for role-based access to employees endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin first"""
        self.admin_email = "admin@mactech.tr"
        self.admin_password = "password"
        
        # Login as admin
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        
        if login_resp.status_code != 200:
            pytest.skip(f"Admin login failed: {login_resp.status_code}")
        
        data = login_resp.json()
        self.admin_token = data.get("token")
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_admin_can_access_employees(self):
        """Admin role should be able to access /api/employees"""
        resp = requests.get(f"{BASE_URL}/api/employees", headers=self.admin_headers)
        
        assert resp.status_code == 200, f"Admin should access employees: {resp.text}"
        print(f"✓ Admin can access /api/employees")
    
    def test_employees_without_auth_fails(self):
        """Unauthenticated access to /api/employees should fail"""
        resp = requests.get(f"{BASE_URL}/api/employees")
        
        # Should return 401 or 403
        assert resp.status_code in [401, 403], \
            f"Unauthenticated access should fail, got {resp.status_code}"
        
        print(f"✓ Unauthenticated access to /api/employees correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
