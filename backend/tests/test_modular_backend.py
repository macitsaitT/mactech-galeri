"""
Comprehensive Backend Tests for Galeri CRM Modular Refactoring
Tests all CRUD operations, multi-tenancy isolation, and role-based access control.

Modules tested:
- Auth: register, login, me, profile update
- Cars: CRUD + soft delete + restore + sold_by auto-population
- Customers: CRUD + soft delete + restore + encrypt
- Transactions: CRUD + soft delete + restore
- Appointments: CRUD + soft delete + restore
- Users: CRUD + admin-only access
- Stats: dashboard statistics
- Permissions: get/update org permissions
- Exports: Word export endpoints
"""

import pytest
import requests
import uuid
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefixes for cleanup
TEST_PREFIX = "TEST_MODULAR_"


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")
    
    def test_root_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "running"
        print("✓ Root endpoint working")


class TestAuthModule:
    """Tests for authentication routes: register, login, me, profile"""
    
    @pytest.fixture(scope="class")
    def test_user(self):
        """Create a test user for auth tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}auth_{unique_id}@test.com"
        password = "testpassword123"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "company_name": f"{TEST_PREFIX}AuthTest Company",
            "phone": "5551234567"
        })
        
        if response.status_code == 400 and "already registered" in response.text:
            # User exists, try to login
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": password
            })
            assert login_resp.status_code == 200
            data = login_resp.json()
            return {"email": email, "password": password, "token": data["token"], "user": data["user"]}
        
        assert response.status_code == 200
        data = response.json()
        return {"email": email, "password": password, "token": data["token"], "user": data["user"]}
    
    def test_register_creates_admin_with_own_org(self, test_user):
        """POST /api/auth/register - new user registration creates admin with own org_id"""
        user = test_user["user"]
        assert user["role"] == "admin"
        assert user["org_id"] == user["id"]  # org_id should match user id for admin
        print(f"✓ User registered as admin with org_id={user['org_id']}")
    
    def test_register_returns_token(self, test_user):
        """POST /api/auth/register - returns valid token"""
        assert "token" in test_user
        assert len(test_user["token"]) > 50  # JWT tokens are long
        print("✓ Registration returns valid token")
    
    def test_login_returns_token_and_user(self, test_user):
        """POST /api/auth/login - login returns token and user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_user["email"],
            "password": test_user["password"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == test_user["email"]
        print("✓ Login returns token and user data")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login - invalid credentials return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@invalid.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials return 401")
    
    def test_get_me(self, test_user):
        """GET /api/auth/me - returns current user info"""
        headers = {"Authorization": f"Bearer {test_user['token']}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user["email"]
        assert "password_hash" not in data  # Should not expose password hash
        print("✓ GET /api/auth/me returns user info without password_hash")
    
    def test_update_profile(self, test_user):
        """PUT /api/auth/profile - update user profile"""
        headers = {"Authorization": f"Bearer {test_user['token']}"}
        new_company = f"{TEST_PREFIX}Updated Company"
        response = requests.put(f"{BASE_URL}/api/auth/profile", headers=headers, json={
            "company_name": new_company,
            "phone": "5559999999"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["company_name"] == new_company
        print("✓ Profile update working")


class TestOrgModule:
    """Tests for organization-related endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for org tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}org_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Org Test Company"
        })
        if response.status_code == 200:
            token = response.json()["token"]
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "password"
            })
            token = login_resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_org_owner(self, auth_headers):
        """GET /api/org/owner - returns organization owner details"""
        response = requests.get(f"{BASE_URL}/api/org/owner", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "company_name" in data
        print("✓ GET /api/org/owner returns owner details")


class TestCarsModule:
    """Tests for car CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_context(self):
        """Create user and return auth context for car tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}cars_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Cars Test Company"
        })
        if response.status_code == 200:
            data = response.json()
            token = data["token"]
            user_id = data["user"]["id"]
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "password"
            })
            data = login_resp.json()
            token = data["token"]
            user_id = data["user"]["id"]
        return {"headers": {"Authorization": f"Bearer {token}"}, "user_id": user_id}
    
    def test_create_car(self, auth_context):
        """POST /api/cars - create a car"""
        headers = auth_context["headers"]
        car_data = {
            "brand": "TEST_BMW",
            "model": "X5",
            "year": 2023,
            "plate": f"{TEST_PREFIX}34ABC123",
            "km": "15000",
            "fuel_type": "Benzin",
            "gear": "Otomatik",
            "status": "Stokta",
            "purchase_price": 500000,
            "sale_price": 550000
        }
        response = requests.post(f"{BASE_URL}/api/cars", headers=headers, json=car_data)
        assert response.status_code == 200
        data = response.json()
        assert data["brand"] == "TEST_BMW"
        assert data["model"] == "X5"
        assert "id" in data
        assert data["deleted"] == False
        auth_context["car_id"] = data["id"]
        print(f"✓ Car created with id={data['id']}")
        return data
    
    def test_get_cars_list(self, auth_context):
        """GET /api/cars - list cars for org"""
        headers = auth_context["headers"]
        response = requests.get(f"{BASE_URL}/api/cars", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/cars returns list of {len(data)} cars")
    
    def test_update_car(self, auth_context):
        """PUT /api/cars/{id} - update car"""
        if "car_id" not in auth_context:
            self.test_create_car(auth_context)
        
        headers = auth_context["headers"]
        car_id = auth_context["car_id"]
        
        updated_data = {
            "brand": "TEST_BMW",
            "model": "X5 Updated",
            "year": 2023,
            "plate": f"{TEST_PREFIX}34ABC123",
            "km": "20000",
            "fuel_type": "Benzin",
            "gear": "Otomatik",
            "status": "Stokta",
            "purchase_price": 500000,
            "sale_price": 600000
        }
        response = requests.put(f"{BASE_URL}/api/cars/{car_id}", headers=headers, json=updated_data)
        assert response.status_code == 200
        data = response.json()
        assert data["model"] == "X5 Updated"
        assert data["sale_price"] == 600000
        print("✓ Car updated successfully")
    
    def test_patch_car_sold_by_auto_populate(self, auth_context):
        """PATCH /api/cars/{id} - test sold_by auto-population when status=Satıldı"""
        if "car_id" not in auth_context:
            self.test_create_car(auth_context)
        
        headers = auth_context["headers"]
        car_id = auth_context["car_id"]
        
        # Set status to "Satıldı" (Sold) - should auto-populate sold_by fields
        response = requests.patch(f"{BASE_URL}/api/cars/{car_id}", headers=headers, json={
            "status": "Satıldı"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "Satıldı"
        assert "sold_by_user_id" in data
        assert "sold_by_name" in data
        print(f"✓ PATCH car with status=Satıldı auto-populates sold_by_user_id={data.get('sold_by_user_id')}")
    
    def test_patch_car_status_revert_clears_sold_by(self, auth_context):
        """PATCH /api/cars/{id} - reverting from Satıldı clears sold_by fields"""
        if "car_id" not in auth_context:
            self.test_create_car(auth_context)
        
        headers = auth_context["headers"]
        car_id = auth_context["car_id"]
        
        # Revert status to "Stokta"
        response = requests.patch(f"{BASE_URL}/api/cars/{car_id}", headers=headers, json={
            "status": "Stokta"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "Stokta"
        assert data.get("sold_by_user_id", "") == ""
        print("✓ Reverting status clears sold_by fields")
    
    def test_delete_car_soft_delete(self, auth_context):
        """DELETE /api/cars/{id} - soft delete car + cascade to transactions"""
        if "car_id" not in auth_context:
            self.test_create_car(auth_context)
        
        headers = auth_context["headers"]
        car_id = auth_context["car_id"]
        
        response = requests.delete(f"{BASE_URL}/api/cars/{car_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        # Verify car is soft-deleted (still exists but deleted=True)
        cars_response = requests.get(f"{BASE_URL}/api/cars", headers=headers)
        cars = cars_response.json()
        deleted_car = next((c for c in cars if c["id"] == car_id), None)
        assert deleted_car is not None
        assert deleted_car["deleted"] == True
        print("✓ Car soft-deleted successfully")
    
    def test_restore_car(self, auth_context):
        """POST /api/cars/{id}/restore - restore soft-deleted car"""
        if "car_id" not in auth_context:
            self.test_create_car(auth_context)
            self.test_delete_car_soft_delete(auth_context)
        
        headers = auth_context["headers"]
        car_id = auth_context["car_id"]
        
        response = requests.post(f"{BASE_URL}/api/cars/{car_id}/restore", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == False
        print("✓ Car restored successfully")


class TestCustomersModule:
    """Tests for customer CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_context(self):
        """Create user and return auth context for customer tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}customers_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Customers Test Company"
        })
        if response.status_code == 200:
            token = response.json()["token"]
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "password"
            })
            token = login_resp.json()["token"]
        return {"headers": {"Authorization": f"Bearer {token}"}}
    
    def test_create_customer(self, auth_context):
        """POST /api/customers - create customer"""
        headers = auth_context["headers"]
        customer_data = {
            "name": f"{TEST_PREFIX}John Doe",
            "phone": "5551234567",
            "type": "Potansiyel",
            "notes": "Test customer notes"
        }
        response = requests.post(f"{BASE_URL}/api/customers", headers=headers, json=customer_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == f"{TEST_PREFIX}John Doe"
        assert "id" in data
        auth_context["customer_id"] = data["id"]
        print(f"✓ Customer created with id={data['id']}")
    
    def test_get_customers_list(self, auth_context):
        """GET /api/customers - list customers"""
        headers = auth_context["headers"]
        response = requests.get(f"{BASE_URL}/api/customers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/customers returns list of {len(data)} customers")
    
    def test_update_customer(self, auth_context):
        """PUT /api/customers/{id} - update customer"""
        if "customer_id" not in auth_context:
            self.test_create_customer(auth_context)
        
        headers = auth_context["headers"]
        customer_id = auth_context["customer_id"]
        
        updated_data = {
            "name": f"{TEST_PREFIX}John Doe Updated",
            "phone": "5559999999",
            "type": "Alıcı",
            "notes": "Updated notes"
        }
        response = requests.put(f"{BASE_URL}/api/customers/{customer_id}", headers=headers, json=updated_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == f"{TEST_PREFIX}John Doe Updated"
        print("✓ Customer updated successfully")
    
    def test_delete_customer_soft_delete(self, auth_context):
        """DELETE /api/customers/{id} - soft delete customer"""
        if "customer_id" not in auth_context:
            self.test_create_customer(auth_context)
        
        headers = auth_context["headers"]
        customer_id = auth_context["customer_id"]
        
        response = requests.delete(f"{BASE_URL}/api/customers/{customer_id}", headers=headers)
        assert response.status_code == 200
        assert response.json()["success"] == True
        print("✓ Customer soft-deleted successfully")
    
    def test_restore_customer(self, auth_context):
        """POST /api/customers/{id}/restore - restore customer"""
        if "customer_id" not in auth_context:
            self.test_create_customer(auth_context)
            self.test_delete_customer_soft_delete(auth_context)
        
        headers = auth_context["headers"]
        customer_id = auth_context["customer_id"]
        
        response = requests.post(f"{BASE_URL}/api/customers/{customer_id}/restore", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == False
        print("✓ Customer restored successfully")


class TestTransactionsModule:
    """Tests for transaction CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_context(self):
        """Create user and return auth context for transaction tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}trans_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Transactions Test Company"
        })
        if response.status_code == 200:
            token = response.json()["token"]
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "password"
            })
            token = login_resp.json()["token"]
        return {"headers": {"Authorization": f"Bearer {token}"}}
    
    def test_create_transaction(self, auth_context):
        """POST /api/transactions - create transaction"""
        headers = auth_context["headers"]
        transaction_data = {
            "type": "income",
            "category": "Araç Satışı",
            "description": f"{TEST_PREFIX}Test sale transaction",
            "amount": 100000,
            "date": "2025-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/transactions", headers=headers, json=transaction_data)
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "income"
        assert data["amount"] == 100000
        assert "id" in data
        auth_context["transaction_id"] = data["id"]
        print(f"✓ Transaction created with id={data['id']}")
    
    def test_get_transactions_list(self, auth_context):
        """GET /api/transactions - list transactions"""
        headers = auth_context["headers"]
        response = requests.get(f"{BASE_URL}/api/transactions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/transactions returns list of {len(data)} transactions")
    
    def test_update_transaction(self, auth_context):
        """PUT /api/transactions/{id} - update transaction"""
        if "transaction_id" not in auth_context:
            self.test_create_transaction(auth_context)
        
        headers = auth_context["headers"]
        transaction_id = auth_context["transaction_id"]
        
        response = requests.put(f"{BASE_URL}/api/transactions/{transaction_id}", headers=headers, json={
            "amount": 150000,
            "description": f"{TEST_PREFIX}Updated transaction"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 150000
        print("✓ Transaction updated successfully")
    
    def test_delete_transaction_soft_delete(self, auth_context):
        """DELETE /api/transactions/{id} - soft delete"""
        if "transaction_id" not in auth_context:
            self.test_create_transaction(auth_context)
        
        headers = auth_context["headers"]
        transaction_id = auth_context["transaction_id"]
        
        response = requests.delete(f"{BASE_URL}/api/transactions/{transaction_id}", headers=headers)
        assert response.status_code == 200
        assert response.json()["success"] == True
        print("✓ Transaction soft-deleted successfully")
    
    def test_restore_transaction(self, auth_context):
        """POST /api/transactions/{id}/restore - restore"""
        if "transaction_id" not in auth_context:
            self.test_create_transaction(auth_context)
            self.test_delete_transaction_soft_delete(auth_context)
        
        headers = auth_context["headers"]
        transaction_id = auth_context["transaction_id"]
        
        response = requests.post(f"{BASE_URL}/api/transactions/{transaction_id}/restore", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == False
        print("✓ Transaction restored successfully")


class TestAppointmentsModule:
    """Tests for appointment CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_context(self):
        """Create user and return auth context for appointment tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}appt_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Appointments Test Company"
        })
        if response.status_code == 200:
            token = response.json()["token"]
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "password"
            })
            token = login_resp.json()["token"]
        return {"headers": {"Authorization": f"Bearer {token}"}}
    
    def test_create_appointment(self, auth_context):
        """POST /api/appointments - create appointment"""
        headers = auth_context["headers"]
        appointment_data = {
            "title": f"{TEST_PREFIX}Test Appointment",
            "customer_name": "Test Customer",
            "customer_phone": "5551234567",
            "date": "2025-02-01",
            "time": "10:00",
            "notes": "Test notes",
            "status": "Bekliyor"
        }
        response = requests.post(f"{BASE_URL}/api/appointments", headers=headers, json=appointment_data)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == f"{TEST_PREFIX}Test Appointment"
        assert "id" in data
        auth_context["appointment_id"] = data["id"]
        print(f"✓ Appointment created with id={data['id']}")
    
    def test_get_appointments_list(self, auth_context):
        """GET /api/appointments - list appointments"""
        headers = auth_context["headers"]
        response = requests.get(f"{BASE_URL}/api/appointments", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/appointments returns list of {len(data)} appointments")
    
    def test_update_appointment(self, auth_context):
        """PUT /api/appointments/{id} - update appointment"""
        if "appointment_id" not in auth_context:
            self.test_create_appointment(auth_context)
        
        headers = auth_context["headers"]
        appointment_id = auth_context["appointment_id"]
        
        response = requests.put(f"{BASE_URL}/api/appointments/{appointment_id}", headers=headers, json={
            "title": f"{TEST_PREFIX}Updated Appointment",
            "status": "Tamamlandı"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "Tamamlandı"
        print("✓ Appointment updated successfully")
    
    def test_delete_appointment_soft_delete(self, auth_context):
        """DELETE /api/appointments/{id} - soft delete"""
        if "appointment_id" not in auth_context:
            self.test_create_appointment(auth_context)
        
        headers = auth_context["headers"]
        appointment_id = auth_context["appointment_id"]
        
        response = requests.delete(f"{BASE_URL}/api/appointments/{appointment_id}", headers=headers)
        assert response.status_code == 200
        assert response.json()["success"] == True
        print("✓ Appointment soft-deleted successfully")
    
    def test_restore_appointment(self, auth_context):
        """POST /api/appointments/{id}/restore - restore"""
        if "appointment_id" not in auth_context:
            self.test_create_appointment(auth_context)
            self.test_delete_appointment_soft_delete(auth_context)
        
        headers = auth_context["headers"]
        appointment_id = auth_context["appointment_id"]
        
        response = requests.post(f"{BASE_URL}/api/appointments/{appointment_id}/restore", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == False
        print("✓ Appointment restored successfully")


class TestStatsModule:
    """Tests for dashboard statistics"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for stats tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}stats_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Stats Test Company"
        })
        if response.status_code == 200:
            token = response.json()["token"]
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "password"
            })
            token = login_resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_stats(self, auth_headers):
        """GET /api/stats - dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected stats fields are present
        expected_fields = [
            "total_cars", "stock_cars", "consignment_cars", "sold_cars",
            "deposit_cars", "total_income", "total_expense", "net_profit",
            "stock_value", "total_customers"
        ]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Stats endpoint returns all required fields: {list(data.keys())}")


class TestPermissionsModule:
    """Tests for permission management"""
    
    @pytest.fixture(scope="class")
    def admin_context(self):
        """Create admin user for permissions tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}perms_admin_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Permissions Test Company"
        })
        if response.status_code == 200:
            data = response.json()
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "password"
            })
            data = login_resp.json()
        return {"headers": {"Authorization": f"Bearer {data['token']}"}, "user": data.get("user", {})}
    
    def test_get_permissions(self, admin_context):
        """GET /api/permissions - get org permissions"""
        headers = admin_context["headers"]
        response = requests.get(f"{BASE_URL}/api/permissions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "org_id" in data
        assert "role_defaults" in data or "user_overrides" in data
        print("✓ GET /api/permissions returns org permissions")
    
    def test_update_permissions_admin_only(self, admin_context):
        """PUT /api/permissions - update permissions (admin only)"""
        headers = admin_context["headers"]
        response = requests.put(f"{BASE_URL}/api/permissions", headers=headers, json={
            "role_defaults": {
                "satis": {
                    "vehicles_view": True,
                    "vehicles_add": True,
                    "vehicles_edit": True
                }
            }
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Admin can update permissions")


class TestUsersModule:
    """Tests for user management"""
    
    @pytest.fixture(scope="class")
    def admin_context(self):
        """Create admin user for user management tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}users_admin_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Users Test Company"
        })
        if response.status_code == 200:
            data = response.json()
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "password"
            })
            data = login_resp.json()
        return {"headers": {"Authorization": f"Bearer {data['token']}"}, "user": data.get("user", {})}
    
    def test_get_users(self, admin_context):
        """GET /api/users - list org users"""
        headers = admin_context["headers"]
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # At least the admin user
        print(f"✓ GET /api/users returns list of {len(data)} users")
    
    def test_create_user_admin_only(self, admin_context):
        """POST /api/users - create user in org (admin only)"""
        headers = admin_context["headers"]
        unique_id = str(uuid.uuid4())[:8]
        new_user_email = f"{TEST_PREFIX}new_user_{unique_id}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/users", headers=headers, json={
            "email": new_user_email,
            "password": "password123",
            "company_name": f"{TEST_PREFIX}New User",
            "phone": "5551234567",
            "role": "satis"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == new_user_email
        assert data["role"] == "satis"
        admin_context["created_user_id"] = data["id"]
        print(f"✓ Admin created new user with id={data['id']}")
    
    def test_update_user(self, admin_context):
        """PUT /api/users/{id} - update user"""
        if "created_user_id" not in admin_context:
            self.test_create_user_admin_only(admin_context)
        
        headers = admin_context["headers"]
        user_id = admin_context["created_user_id"]
        
        response = requests.put(f"{BASE_URL}/api/users/{user_id}", headers=headers, json={
            "role": "muhasebe",
            "company_name": f"{TEST_PREFIX}Updated User"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "muhasebe"
        print("✓ User updated successfully")
    
    def test_delete_user_admin_only(self, admin_context):
        """DELETE /api/users/{id} - delete user (admin only)"""
        if "created_user_id" not in admin_context:
            self.test_create_user_admin_only(admin_context)
        
        headers = admin_context["headers"]
        user_id = admin_context["created_user_id"]
        
        response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=headers)
        assert response.status_code == 200
        assert response.json()["success"] == True
        print("✓ User deleted successfully")
    
    def test_cannot_delete_self(self, admin_context):
        """DELETE /api/users/{id} - admin can't delete themselves"""
        headers = admin_context["headers"]
        
        # Get current user ID
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        user_id = me_response.json()["id"]
        
        response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=headers)
        assert response.status_code == 400
        assert "silemezsiniz" in response.json().get("detail", "").lower() or "cannot" in response.json().get("detail", "").lower()
        print("✓ Admin cannot delete themselves")
    
    def test_get_employees(self, admin_context):
        """GET /api/employees - list employees for dropdown"""
        headers = admin_context["headers"]
        response = requests.get(f"{BASE_URL}/api/employees", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "name" in data[0]
        print(f"✓ GET /api/employees returns list of {len(data)} employees")
    
    def test_get_org_users(self, admin_context):
        """GET /api/org-users - list org users for filtering"""
        headers = admin_context["headers"]
        response = requests.get(f"{BASE_URL}/api/org-users", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "name" in data[0]
        print(f"✓ GET /api/org-users returns list of {len(data)} users")


class TestRoleBasedAccess:
    """Tests for role-based access control - non-admin cannot create/delete users"""
    
    @pytest.fixture(scope="class")
    def non_admin_context(self):
        """Create admin first, then create a non-admin user in the same org"""
        unique_id = str(uuid.uuid4())[:8]
        
        # First create admin
        admin_email = f"{TEST_PREFIX}rbac_admin_{unique_id}@test.com"
        admin_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": admin_email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}RBAC Test Company"
        })
        if admin_response.status_code == 200:
            admin_data = admin_response.json()
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": admin_email,
                "password": "password"
            })
            admin_data = login_resp.json()
        
        admin_headers = {"Authorization": f"Bearer {admin_data['token']}"}
        
        # Create non-admin user in same org
        non_admin_email = f"{TEST_PREFIX}rbac_satis_{unique_id}@test.com"
        create_response = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json={
            "email": non_admin_email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Sales Person",
            "role": "satis"
        })
        
        # Login as non-admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": non_admin_email,
            "password": "password"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Could not create non-admin user for RBAC tests")
        
        non_admin_data = login_response.json()
        return {
            "headers": {"Authorization": f"Bearer {non_admin_data['token']}"},
            "user": non_admin_data["user"],
            "admin_headers": admin_headers
        }
    
    def test_non_admin_cannot_create_user(self, non_admin_context):
        """Non-admin cannot create users"""
        headers = non_admin_context["headers"]
        unique_id = str(uuid.uuid4())[:8]
        
        response = requests.post(f"{BASE_URL}/api/users", headers=headers, json={
            "email": f"{TEST_PREFIX}forbidden_user_{unique_id}@test.com",
            "password": "password",
            "company_name": "Forbidden",
            "role": "satis"
        })
        assert response.status_code == 403
        print("✓ Non-admin cannot create users (403 Forbidden)")
    
    def test_non_admin_cannot_delete_user(self, non_admin_context):
        """Non-admin cannot delete users"""
        headers = non_admin_context["headers"]
        user_id = non_admin_context["user"]["id"]
        
        response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=headers)
        assert response.status_code == 403
        print("✓ Non-admin cannot delete users (403 Forbidden)")
    
    def test_non_admin_cannot_update_permissions(self, non_admin_context):
        """Non-admin cannot update permissions"""
        headers = non_admin_context["headers"]
        
        response = requests.put(f"{BASE_URL}/api/permissions", headers=headers, json={
            "role_defaults": {"satis": {"vehicles_view": True}}
        })
        assert response.status_code == 403
        print("✓ Non-admin cannot update permissions (403 Forbidden)")


class TestMultiTenantIsolation:
    """Tests for multi-tenant data isolation - users from different orgs cannot see each other's data"""
    
    @pytest.fixture(scope="class")
    def two_tenants(self):
        """Create two separate organizations with their own data"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Org 1
        org1_email = f"{TEST_PREFIX}tenant1_{unique_id}@test.com"
        org1_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": org1_email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Tenant 1 Company"
        })
        if org1_response.status_code == 200:
            org1_data = org1_response.json()
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": org1_email,
                "password": "password"
            })
            org1_data = login_resp.json()
        
        org1_headers = {"Authorization": f"Bearer {org1_data['token']}"}
        
        # Create a car in org1
        car_response = requests.post(f"{BASE_URL}/api/cars", headers=org1_headers, json={
            "brand": f"{TEST_PREFIX}TENANT1_BMW",
            "model": "Tenant1 Model",
            "year": 2023,
            "plate": f"{TEST_PREFIX}TENANT1_PLATE",
            "km": "10000"
        })
        org1_car_id = car_response.json().get("id") if car_response.status_code == 200 else None
        
        # Org 2
        org2_email = f"{TEST_PREFIX}tenant2_{unique_id}@test.com"
        org2_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": org2_email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Tenant 2 Company"
        })
        if org2_response.status_code == 200:
            org2_data = org2_response.json()
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": org2_email,
                "password": "password"
            })
            org2_data = login_resp.json()
        
        org2_headers = {"Authorization": f"Bearer {org2_data['token']}"}
        
        return {
            "org1_headers": org1_headers,
            "org1_car_id": org1_car_id,
            "org2_headers": org2_headers
        }
    
    def test_org2_cannot_see_org1_cars(self, two_tenants):
        """Users from Org 2 cannot see Org 1's cars"""
        org2_headers = two_tenants["org2_headers"]
        org1_car_id = two_tenants["org1_car_id"]
        
        # Get all cars visible to org2
        response = requests.get(f"{BASE_URL}/api/cars", headers=org2_headers)
        assert response.status_code == 200
        cars = response.json()
        
        # Verify org1's car is not in org2's list
        org1_car_in_list = any(c.get("id") == org1_car_id for c in cars)
        assert not org1_car_in_list, "Org 2 can see Org 1's car - isolation broken!"
        print("✓ Org 2 cannot see Org 1's cars - multi-tenant isolation working")
    
    def test_org2_cannot_modify_org1_car(self, two_tenants):
        """Users from Org 2 cannot modify Org 1's cars"""
        org2_headers = two_tenants["org2_headers"]
        org1_car_id = two_tenants["org1_car_id"]
        
        if org1_car_id:
            # Try to update org1's car using org2's credentials
            response = requests.patch(f"{BASE_URL}/api/cars/{org1_car_id}", headers=org2_headers, json={
                "status": "Satıldı"
            })
            assert response.status_code == 404  # Should not find the car
            print("✓ Org 2 cannot modify Org 1's car - 404 returned as expected")
    
    def test_org2_cannot_delete_org1_car(self, two_tenants):
        """Users from Org 2 cannot delete Org 1's cars"""
        org2_headers = two_tenants["org2_headers"]
        org1_car_id = two_tenants["org1_car_id"]
        
        if org1_car_id:
            response = requests.delete(f"{BASE_URL}/api/cars/{org1_car_id}", headers=org2_headers)
            assert response.status_code == 404  # Should not find the car
            print("✓ Org 2 cannot delete Org 1's car - 404 returned as expected")


class TestExportsModule:
    """Tests for Word export endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for export tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}exports_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Exports Test Company"
        })
        if response.status_code == 200:
            token = response.json()["token"]
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "password"
            })
            token = login_resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_export_cars_word(self, auth_headers):
        """GET /api/export/cars - Word export"""
        response = requests.get(f"{BASE_URL}/api/export/cars", headers=auth_headers)
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in response.headers.get("content-type", "")
        print("✓ GET /api/export/cars returns Word document")
    
    def test_export_customers_word(self, auth_headers):
        """GET /api/export/customers - Word export"""
        response = requests.get(f"{BASE_URL}/api/export/customers", headers=auth_headers)
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in response.headers.get("content-type", "")
        print("✓ GET /api/export/customers returns Word document")
    
    def test_export_transactions_word(self, auth_headers):
        """GET /api/export/transactions - Word export"""
        response = requests.get(f"{BASE_URL}/api/export/transactions", headers=auth_headers)
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in response.headers.get("content-type", "")
        print("✓ GET /api/export/transactions returns Word document")


class TestEncryptionModule:
    """Tests for customer data encryption"""
    
    @pytest.fixture(scope="class")
    def auth_context(self):
        """Create user and customer for encryption tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}encrypt_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password",
            "company_name": f"{TEST_PREFIX}Encryption Test Company"
        })
        if response.status_code == 200:
            token = response.json()["token"]
        else:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "password"
            })
            token = login_resp.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create a customer to encrypt
        customer_response = requests.post(f"{BASE_URL}/api/customers", headers=headers, json={
            "name": f"{TEST_PREFIX}Encrypt Customer",
            "phone": "5551234567",
            "notes": "Sensitive customer notes"
        })
        customer_id = customer_response.json().get("id") if customer_response.status_code == 200 else None
        
        return {"headers": headers, "customer_id": customer_id}
    
    def test_encrypt_customer_data(self, auth_context):
        """POST /api/encrypt-customer/{id} - encrypt customer data"""
        headers = auth_context["headers"]
        customer_id = auth_context["customer_id"]
        
        if not customer_id:
            pytest.skip("No customer created for encryption test")
        
        response = requests.post(f"{BASE_URL}/api/encrypt-customer/{customer_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Customer data encrypted successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
