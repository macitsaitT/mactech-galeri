"""
Test Google OAuth and Notification Features (Iteration 30)
- Backend: POST /api/auth/google endpoint validation
- Google OAuth: session_id validation, error responses
- Email/password login still works (regression)
- Registration with phone still works (regression)
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://crm-modular-build.preview.emergentagent.com"


class TestGoogleOAuthEndpoint:
    """Google OAuth POST /api/auth/google endpoint tests"""
    
    def test_google_auth_without_session_id_returns_400(self):
        """POST /api/auth/google without session_id should return 400"""
        response = requests.post(f"{BASE_URL}/api/auth/google", json={})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "session_id" in data.get("detail", "").lower() or "gerekli" in data.get("detail", "").lower()
        print(f"✓ POST /api/auth/google without session_id returns 400: {data}")
    
    def test_google_auth_with_empty_session_id_returns_400(self):
        """POST /api/auth/google with empty session_id should return 400"""
        response = requests.post(f"{BASE_URL}/api/auth/google", json={"session_id": ""})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ POST /api/auth/google with empty session_id returns 400")
    
    def test_google_auth_with_invalid_session_id_returns_401_or_502(self):
        """POST /api/auth/google with invalid session_id should return 401 or 502"""
        response = requests.post(f"{BASE_URL}/api/auth/google", json={"session_id": "invalid_session_12345"})
        # Could be 401 (invalid session) or 502 (service unavailable)
        assert response.status_code in [401, 502], f"Expected 401 or 502, got {response.status_code}: {response.text}"
        print(f"✓ POST /api/auth/google with invalid session_id returns {response.status_code}")
    
    def test_google_auth_endpoint_exists(self):
        """POST /api/auth/google endpoint should exist (not 404)"""
        response = requests.post(f"{BASE_URL}/api/auth/google", json={"session_id": "test"})
        assert response.status_code != 404, "Google auth endpoint does not exist"
        assert response.status_code != 405, "Method not allowed - endpoint may not accept POST"
        print(f"✓ POST /api/auth/google endpoint exists, status: {response.status_code}")


class TestStandardAuthRegression:
    """Ensure standard email/password auth still works"""
    
    def test_register_new_user_with_phone(self):
        """POST /api/auth/register should work with all fields including phone"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "email": f"test_iter30_{unique_id}@test.com",
            "password": "password123",
            "company_name": "Test Company",
            "phone": "0532 123 45 67"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == payload["email"].lower()
        assert "verification_code" in data, "No verification code (demo mode)"
        
        print(f"✓ Registration successful for {payload['email']}")
        return data["token"], payload["email"]
    
    def test_login_existing_user(self):
        """POST /api/auth/login should work with valid credentials"""
        # First register a user
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_login_{unique_id}@test.com"
        password = "password123"
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "company_name": "Login Test",
            "phone": "0532 111 22 33"
        })
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        
        # Now login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        assert "token" in data
        assert data["user"]["email"] == email.lower()
        print(f"✓ Login successful for {email}")
    
    def test_login_with_wrong_password_returns_401(self):
        """POST /api/auth/login with wrong password should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Login with wrong credentials returns 401")
    
    def test_register_with_short_password_returns_error(self):
        """POST /api/auth/register with <8 char password should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "shortpw@test.com",
            "password": "short",
            "company_name": "Short PW Test",
            "phone": "0532 999 88 77"
        })
        # Should return 400 or 422 for validation error
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}: {response.text}"
        print(f"✓ Register with short password returns {response.status_code}")


class TestCRUDRegression:
    """Ensure CRUD operations still work (quick sanity tests)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for CRUD tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"crud_test_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password123",
            "company_name": "CRUD Test Co",
            "phone": "0532 000 00 00"
        })
        assert response.status_code == 200, f"Auth failed: {response.text}"
        return response.json()["token"]
    
    def test_dashboard_stats_load(self, auth_token):
        """GET /api/stats should return dashboard data"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/stats", headers=headers)
        assert response.status_code == 200, f"Stats failed: {response.text}"
        
        data = response.json()
        assert "total_cars" in data or "cars" in data or "car_count" in data or isinstance(data, dict)
        print(f"✓ Dashboard stats loaded successfully")
    
    def test_cars_list(self, auth_token):
        """GET /api/cars should return list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/cars", headers=headers)
        assert response.status_code == 200, f"Cars list failed: {response.text}"
        assert isinstance(response.json(), list)
        print(f"✓ Cars list loaded successfully")
    
    def test_customers_list(self, auth_token):
        """GET /api/customers should return list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/customers", headers=headers)
        assert response.status_code == 200, f"Customers list failed: {response.text}"
        assert isinstance(response.json(), list)
        print(f"✓ Customers list loaded successfully")
    
    def test_transactions_list(self, auth_token):
        """GET /api/transactions should return list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/transactions", headers=headers)
        assert response.status_code == 200, f"Transactions list failed: {response.text}"
        assert isinstance(response.json(), list)
        print(f"✓ Transactions list loaded successfully")
    
    def test_appointments_list(self, auth_token):
        """GET /api/appointments should return list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/appointments", headers=headers)
        assert response.status_code == 200, f"Appointments list failed: {response.text}"
        assert isinstance(response.json(), list)
        print(f"✓ Appointments list loaded successfully")
    
    def test_create_car(self, auth_token):
        """POST /api/cars should create a car"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        car_data = {
            "brand": "Test BMW",
            "model": "Test 320i",
            "year": 2023,
            "plate": f"34 T{int(time.time()) % 10000}",
            "purchase_price": 500000,
            "sale_price": 550000,
            "status": "Stokta",
            "ownership": "stock"
        }
        response = requests.post(f"{BASE_URL}/api/cars", headers=headers, json=car_data)
        assert response.status_code in [200, 201], f"Car creation failed: {response.text}"
        
        data = response.json()
        assert data["brand"] == car_data["brand"]
        print(f"✓ Car created successfully: {data.get('id', 'N/A')}")
        return data["id"]
    
    def test_create_customer(self, auth_token):
        """POST /api/customers should create a customer"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        customer_data = {
            "name": "Test Müşteri",
            "phone": "0533 111 22 33",
            "email": "musteri@test.com",
            "type": "individual"
        }
        response = requests.post(f"{BASE_URL}/api/customers", headers=headers, json=customer_data)
        assert response.status_code in [200, 201], f"Customer creation failed: {response.text}"
        
        data = response.json()
        assert data["name"] == customer_data["name"]
        print(f"✓ Customer created successfully: {data.get('id', 'N/A')}")


class TestYearEndTransferRegression:
    """Quick sanity check for year-end transfer feature"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"yearend_test_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password123",
            "company_name": "Year-End Test",
            "phone": "0532 555 66 77"
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_year_end_transfers_list(self, admin_token):
        """GET /api/year-end-transfers should work for admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/year-end-transfers", headers=headers)
        assert response.status_code == 200, f"Year-end transfers list failed: {response.text}"
        assert isinstance(response.json(), list)
        print(f"✓ Year-end transfers list works for admin")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
