"""
Test role-based access control and data isolation for Gallery CRM.

Tests cover:
1. Login returns correct user role
2. Satis user only sees their own cars
3. Admin sees all org data
4. Muhasebe sees all org data
5. GET /api/org-users returns all users in org
6. POST /api/users requires admin role (403 for others)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://image-gallery-live.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "test@test.com"
ADMIN_PASSWORD = "password"
SATIS_EMAIL = "satis@test.com"
SATIS_PASSWORD = "password"
MUHASEBE_EMAIL = "muhasebe@test.com"
MUHASEBE_PASSWORD = "password"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def satis_token():
    """Get satis user auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SATIS_EMAIL,
        "password": SATIS_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Satis login failed: {response.status_code}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def muhasebe_token():
    """Get muhasebe user auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": MUHASEBE_EMAIL,
        "password": MUHASEBE_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Muhasebe login failed: {response.status_code}")
    return response.json().get("token")


class TestLoginReturnsRole:
    """Test that login returns correct role for each user type"""

    def test_admin_login_returns_admin_role(self):
        """Admin login should return role='admin'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "admin", f"Expected admin role, got {data['user']['role']}"
        print(f"PASS: Admin login returns role='admin'")

    def test_satis_login_returns_satis_role(self):
        """Satis login should return role='satis'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SATIS_EMAIL,
            "password": SATIS_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "satis", f"Expected satis role, got {data['user']['role']}"
        print(f"PASS: Satis login returns role='satis'")

    def test_muhasebe_login_returns_muhasebe_role(self):
        """Muhasebe login should return role='muhasebe'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": MUHASEBE_EMAIL,
            "password": MUHASEBE_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "muhasebe", f"Expected muhasebe role, got {data['user']['role']}"
        print(f"PASS: Muhasebe login returns role='muhasebe'")


class TestAdminSeesAllOrgData:
    """Admin should see all cars in org (both BMW from admin and Mercedes from satis)"""

    def test_admin_sees_all_cars(self, admin_token):
        """Admin should see 2+ cars (BMW + Mercedes)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/cars", headers=headers)
        assert response.status_code == 200, f"GET /api/cars failed: {response.text}"
        cars = response.json()
        # Admin should see multiple cars including BMW and Mercedes
        brands = [c.get("brand", "").upper() for c in cars]
        print(f"Admin sees {len(cars)} cars: {brands}")
        assert len(cars) >= 2, f"Admin should see at least 2 cars, got {len(cars)}"
        print(f"PASS: Admin sees {len(cars)} cars")


class TestSatisUserSeesOnlyOwnCars:
    """Satis user should only see cars they created (not admin's cars)"""

    def test_satis_sees_only_own_cars(self, satis_token):
        """Satis should only see Mercedes (their own car), not BMW (admin's car)"""
        headers = {"Authorization": f"Bearer {satis_token}"}
        response = requests.get(f"{BASE_URL}/api/cars", headers=headers)
        assert response.status_code == 200, f"GET /api/cars failed: {response.text}"
        cars = response.json()
        brands = [c.get("brand", "").upper() for c in cars]
        print(f"Satis sees {len(cars)} cars: {brands}")
        
        # Satis should see only their own cars
        # Based on test data: admin created BMW, satis created Mercedes
        # Satis should NOT see BMW
        bmw_count = sum(1 for c in cars if "BMW" in c.get("brand", "").upper())
        mercedes_count = sum(1 for c in cars if "MERCEDES" in c.get("brand", "").upper())
        
        print(f"Satis sees {bmw_count} BMW and {mercedes_count} Mercedes")
        assert bmw_count == 0, f"Satis should NOT see BMW (admin's car), but sees {bmw_count}"
        print(f"PASS: Satis only sees their own cars ({len(cars)} total)")


class TestMuhasebeSeeesAllOrgData:
    """Muhasebe should see all org data (like admin)"""

    def test_muhasebe_sees_all_cars(self, muhasebe_token):
        """Muhasebe should see all cars in org (2+)"""
        headers = {"Authorization": f"Bearer {muhasebe_token}"}
        response = requests.get(f"{BASE_URL}/api/cars", headers=headers)
        assert response.status_code == 200, f"GET /api/cars failed: {response.text}"
        cars = response.json()
        brands = [c.get("brand", "").upper() for c in cars]
        print(f"Muhasebe sees {len(cars)} cars: {brands}")
        assert len(cars) >= 2, f"Muhasebe should see at least 2 cars, got {len(cars)}"
        print(f"PASS: Muhasebe sees {len(cars)} cars")


class TestOrgUsersEndpoint:
    """GET /api/org-users should return all users in the same org"""

    def test_org_users_returns_all_users(self, admin_token):
        """Admin should see 3 users in org (admin, satis, muhasebe)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/org-users", headers=headers)
        assert response.status_code == 200, f"GET /api/org-users failed: {response.text}"
        users = response.json()
        print(f"Admin sees {len(users)} org users: {[u.get('name') for u in users]}")
        assert len(users) >= 3, f"Should see at least 3 users, got {len(users)}"
        
        # Check roles are present
        roles = [u.get("role") for u in users]
        assert "admin" in roles, "Should have admin user"
        print(f"PASS: org-users returns {len(users)} users with roles: {roles}")

    def test_satis_can_access_org_users(self, satis_token):
        """Satis should also be able to get org-users for filtering"""
        headers = {"Authorization": f"Bearer {satis_token}"}
        response = requests.get(f"{BASE_URL}/api/org-users", headers=headers)
        assert response.status_code == 200, f"GET /api/org-users failed: {response.text}"
        users = response.json()
        assert len(users) >= 3, f"Should see at least 3 users, got {len(users)}"
        print(f"PASS: Satis can access org-users ({len(users)} users)")


class TestUserCreationRequiresAdmin:
    """POST /api/users should require admin role"""

    def test_admin_can_create_user(self, admin_token):
        """Admin should be able to create users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Try to check if we can at least POST (we won't actually create)
        # Just verify 400 (email required) not 403 (forbidden)
        response = requests.post(f"{BASE_URL}/api/users", headers=headers, json={
            "email": "",
            "password": "test123"
        })
        # Should NOT be 403 for admin
        assert response.status_code != 403, f"Admin should not get 403 on user creation"
        print(f"PASS: Admin can access POST /api/users (status {response.status_code})")

    def test_satis_cannot_create_user(self, satis_token):
        """Satis should get 403 when trying to create user"""
        headers = {"Authorization": f"Bearer {satis_token}"}
        response = requests.post(f"{BASE_URL}/api/users", headers=headers, json={
            "email": "newuser@test.com",
            "password": "test123",
            "company_name": "Test",
            "role": "satis"
        })
        assert response.status_code == 403, f"Satis should get 403, got {response.status_code}: {response.text}"
        print(f"PASS: Satis gets 403 on POST /api/users")

    def test_muhasebe_cannot_create_user(self, muhasebe_token):
        """Muhasebe should get 403 when trying to create user"""
        headers = {"Authorization": f"Bearer {muhasebe_token}"}
        response = requests.post(f"{BASE_URL}/api/users", headers=headers, json={
            "email": "newuser2@test.com",
            "password": "test123",
            "company_name": "Test",
            "role": "satis"
        })
        assert response.status_code == 403, f"Muhasebe should get 403, got {response.status_code}: {response.text}"
        print(f"PASS: Muhasebe gets 403 on POST /api/users")


class TestUsersListEndpoint:
    """GET /api/users - admin sees all, others see only themselves"""

    def test_admin_sees_all_users(self, admin_token):
        """Admin should see all users in org"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200, f"GET /api/users failed: {response.text}"
        users = response.json()
        assert len(users) >= 3, f"Admin should see 3+ users, got {len(users)}"
        print(f"PASS: Admin sees {len(users)} users")

    def test_satis_sees_only_self(self, satis_token):
        """Satis should see only their own info"""
        headers = {"Authorization": f"Bearer {satis_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200, f"GET /api/users failed: {response.text}"
        users = response.json()
        assert len(users) == 1, f"Satis should see only 1 user (self), got {len(users)}"
        assert users[0]["email"] == SATIS_EMAIL, f"Should be their own email"
        print(f"PASS: Satis sees only self ({users[0]['email']})")


class TestEmployeesEndpoint:
    """GET /api/employees should return all employees for dropdown selection"""

    def test_employees_returns_list(self, admin_token):
        """Should return list of employees with id, name, role"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/employees", headers=headers)
        assert response.status_code == 200, f"GET /api/employees failed: {response.text}"
        employees = response.json()
        assert len(employees) >= 3, f"Should have 3+ employees, got {len(employees)}"
        
        # Check structure
        for emp in employees:
            assert "id" in emp, "Employee should have id"
            assert "name" in emp, "Employee should have name"
            assert "role" in emp, "Employee should have role"
        
        print(f"PASS: employees endpoint returns {len(employees)} employees with correct structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
