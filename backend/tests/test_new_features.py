"""
Test new features for Aslanbaş Oto CRM:
1. Word export (instead of Excel)
2. User management API (admin/muhasebe/satis roles)
3. Employees API for dropdown selection
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Test login and authentication"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        pytest.skip("Login failed - cannot proceed with tests")
    
    def test_login_returns_role(self, auth_token):
        """Verify login response includes user role"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "role" in data["user"], "User should have role field"
        print(f"User role: {data['user']['role']}")

class TestUserManagement:
    """Test user management APIs for admin"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login as test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Login failed")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_get_users(self, headers):
        """GET /api/users should return user list with role field"""
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        print(f"Found {len(users)} users")
        if users:
            # Verify role field exists
            for user in users:
                assert "role" in user, f"User {user.get('email')} missing role field"
                print(f"  - {user.get('email')}: role={user.get('role')}")
    
    def test_get_employees(self, headers):
        """GET /api/employees should return employees for dropdown"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=headers)
        assert response.status_code == 200
        employees = response.json()
        assert isinstance(employees, list)
        print(f"Found {len(employees)} employees")
        if employees:
            # Verify employee has required fields for dropdown
            emp = employees[0]
            assert "id" in emp
            assert "name" in emp
            assert "email" in emp
            print(f"  Sample employee: {emp}")
    
    def test_create_user_with_role(self, headers):
        """POST /api/users should create user with role"""
        import uuid
        test_email = f"TEST_satis_{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/users", headers=headers, json={
            "email": test_email,
            "password": "testpass123",
            "company_name": "Test Satış Elemanı",
            "phone": "5551234567",
            "role": "satis"
        })
        
        assert response.status_code == 200, f"Failed: {response.text}"
        user = response.json()
        assert user["role"] == "satis", "Created user should have satis role"
        assert user["email"] == test_email
        print(f"Created user: {user}")
        
        # Cleanup: delete the test user
        user_id = user.get("id")
        if user_id:
            del_response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=headers)
            print(f"Cleanup: deleted test user {user_id}, status={del_response.status_code}")

class TestWordExport:
    """Test Word (.docx) export endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login as test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Login failed")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_export_transactions_word(self, headers):
        """GET /api/export/transactions should return .docx file"""
        response = requests.get(f"{BASE_URL}/api/export/transactions", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        assert "openxmlformats-officedocument.wordprocessingml.document" in content_type, \
            f"Expected Word docx content type, got: {content_type}"
        
        # Check content disposition for .docx filename
        content_disp = response.headers.get("Content-Disposition", "")
        assert ".docx" in content_disp, f"Expected .docx filename, got: {content_disp}"
        print(f"Export transactions: {content_type}, {content_disp}")
    
    def test_export_cars_word(self, headers):
        """GET /api/export/cars should return .docx file"""
        response = requests.get(f"{BASE_URL}/api/export/cars", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        content_type = response.headers.get("Content-Type", "")
        assert "openxmlformats-officedocument.wordprocessingml.document" in content_type
        
        content_disp = response.headers.get("Content-Disposition", "")
        assert ".docx" in content_disp
        print(f"Export cars: {content_type}, {content_disp}")
    
    def test_export_customers_word(self, headers):
        """GET /api/export/customers should return .docx file"""
        response = requests.get(f"{BASE_URL}/api/export/customers", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        content_type = response.headers.get("Content-Type", "")
        assert "openxmlformats-officedocument.wordprocessingml.document" in content_type
        
        content_disp = response.headers.get("Content-Disposition", "")
        assert ".docx" in content_disp
        print(f"Export customers: {content_type}, {content_disp}")

class TestCarsAPI:
    """Test Cars API to ensure data exists for frontend testing"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Login failed")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_get_cars(self, headers):
        """GET /api/cars should return car list"""
        response = requests.get(f"{BASE_URL}/api/cars", headers=headers)
        assert response.status_code == 200
        cars = response.json()
        print(f"Found {len(cars)} cars")
        
        # Find non-deleted cars
        active_cars = [c for c in cars if not c.get("deleted")]
        print(f"Active (non-deleted) cars: {len(active_cars)}")
        
        if active_cars:
            # Show first car for reference
            car = active_cars[0]
            print(f"Sample car: {car.get('brand')} {car.get('model')} - {car.get('plate')} - status: {car.get('status')}")
        
        return active_cars

class TestHealthCheck:
    """Test basic health endpoints"""
    
    def test_api_root(self):
        """GET /api/ should return running status"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"API root: {data}")
    
    def test_health(self):
        """GET /api/health should return healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"Health: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
