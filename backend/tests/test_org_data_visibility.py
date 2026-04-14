"""
Test for org-wide data visibility fix (Bug Fix #1)
and enhanced permissions system (role_defaults + user_overrides)

Tests:
1. Satis user can see cars created by admin (same org)
2. GET /api/permissions returns role_defaults and user_overrides
3. PUT /api/permissions saves both role_defaults and user_overrides
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://galeri.mactech.tr').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@mactech.tr"
ADMIN_PASSWORD = "password"
SATIS_EMAIL = "satis@mactech.tr"
SATIS_PASSWORD = "password"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert data.get("user", {}).get("role") == "admin", "User is not admin"
    return data["token"]


@pytest.fixture(scope="module")
def satis_token():
    """Get satis user token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SATIS_EMAIL,
        "password": SATIS_PASSWORD
    })
    assert response.status_code == 200, f"Satis login failed: {response.text}"
    data = response.json()
    assert data.get("user", {}).get("role") == "satis", "User is not satis role"
    return data["token"]


@pytest.fixture(scope="module")
def admin_user_info(admin_token):
    """Get admin user info"""
    response = requests.get(f"{BASE_URL}/api/auth/me", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    return response.json()


@pytest.fixture(scope="module")
def satis_user_info(satis_token):
    """Get satis user info"""
    response = requests.get(f"{BASE_URL}/api/auth/me", headers={
        "Authorization": f"Bearer {satis_token}"
    })
    return response.json()


class TestOrgDataVisibility:
    """Test that satis users can see all org data (bug fix verification)"""
    
    def test_both_users_same_org(self, admin_user_info, satis_user_info):
        """Verify admin and satis user are in same org"""
        admin_org = admin_user_info.get("org_id")
        satis_org = satis_user_info.get("org_id")
        assert admin_org is not None, "Admin org_id is None"
        assert satis_org is not None, "Satis org_id is None"
        assert admin_org == satis_org, f"Users not in same org: admin={admin_org}, satis={satis_org}"
        print(f"Both users in org: {admin_org}")
    
    def test_admin_creates_car_satis_can_see(self, admin_token, satis_token, admin_user_info):
        """Admin creates a car, satis user should be able to see it"""
        # Admin creates a car
        car_data = {
            "brand": "TEST_OrgVisibility",
            "model": "SatisCanSeeThis",
            "year": 2025,
            "plate": "TEST 123",
            "km": "5000",
            "purchase_price": 100000,
            "sale_price": 120000,
            "status": "Stokta",
            "fuel_type": "Benzin",
            "gear": "Otomatik"
        }
        
        # Create car as admin
        create_response = requests.post(
            f"{BASE_URL}/api/cars",
            json=car_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200, f"Failed to create car: {create_response.text}"
        created_car = create_response.json()
        car_id = created_car["id"]
        print(f"Admin created car: {car_id}")
        
        try:
            # Verify car was created by admin
            assert created_car.get("created_by") == admin_user_info.get("id"), "Car created_by should be admin"
            
            # Satis user fetches all cars
            satis_cars_response = requests.get(
                f"{BASE_URL}/api/cars",
                headers={"Authorization": f"Bearer {satis_token}"}
            )
            assert satis_cars_response.status_code == 200, "Satis failed to fetch cars"
            satis_cars = satis_cars_response.json()
            
            # Find the test car in satis user's response
            test_car = next((c for c in satis_cars if c["id"] == car_id), None)
            assert test_car is not None, f"Satis user cannot see car created by admin! Car ID: {car_id}"
            print(f"SUCCESS: Satis user CAN see car created by admin")
            
            # Verify the car data matches
            assert test_car["brand"] == "TEST_OrgVisibility"
            assert test_car["model"] == "SatisCanSeeThis"
            
        finally:
            # Cleanup: delete the test car
            requests.delete(
                f"{BASE_URL}/api/cars/{car_id}?permanent=true",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            print(f"Cleaned up test car: {car_id}")
    
    def test_satis_creates_car_admin_can_see(self, admin_token, satis_token, satis_user_info):
        """Satis creates a car, admin should be able to see it"""
        car_data = {
            "brand": "TEST_SatisCreated",
            "model": "AdminCanSeeThis",
            "year": 2024,
            "plate": "SATIS 456",
            "km": "3000",
            "purchase_price": 80000,
            "sale_price": 95000,
            "status": "Stokta"
        }
        
        # Create car as satis
        create_response = requests.post(
            f"{BASE_URL}/api/cars",
            json=car_data,
            headers={"Authorization": f"Bearer {satis_token}"}
        )
        assert create_response.status_code == 200, f"Satis failed to create car: {create_response.text}"
        created_car = create_response.json()
        car_id = created_car["id"]
        print(f"Satis created car: {car_id}")
        
        try:
            # Verify car was created by satis
            assert created_car.get("created_by") == satis_user_info.get("id"), "Car created_by should be satis"
            
            # Admin fetches all cars
            admin_cars_response = requests.get(
                f"{BASE_URL}/api/cars",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert admin_cars_response.status_code == 200, "Admin failed to fetch cars"
            admin_cars = admin_cars_response.json()
            
            # Find the test car
            test_car = next((c for c in admin_cars if c["id"] == car_id), None)
            assert test_car is not None, f"Admin cannot see car created by satis! Car ID: {car_id}"
            print(f"SUCCESS: Admin CAN see car created by satis")
            
        finally:
            # Cleanup
            requests.delete(
                f"{BASE_URL}/api/cars/{car_id}?permanent=true",
                headers={"Authorization": f"Bearer {admin_token}"}
            )


class TestPermissionsEndpoint:
    """Test enhanced permissions system with role_defaults and user_overrides"""
    
    def test_get_permissions_returns_structure(self, admin_token):
        """GET /api/permissions should return role_defaults and user_overrides"""
        response = requests.get(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get permissions: {response.text}"
        data = response.json()
        
        # Check structure
        assert "role_defaults" in data, "Missing role_defaults in response"
        assert "user_overrides" in data, "Missing user_overrides in response"
        
        # Check role_defaults has expected roles
        role_defaults = data["role_defaults"]
        assert "muhasebe" in role_defaults, "Missing muhasebe role"
        assert "satis" in role_defaults, "Missing satis role"
        
        # Check some permission keys exist
        assert "vehicles_view" in role_defaults["satis"], "Missing vehicles_view permission"
        assert "vehicles_price_view" in role_defaults["satis"], "Missing vehicles_price_view permission"
        
        print(f"Permissions structure valid. user_overrides: {data['user_overrides']}")
    
    def test_put_permissions_role_defaults(self, admin_token):
        """PUT /api/permissions should save role_defaults"""
        # First get current permissions
        get_response = requests.get(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        current = get_response.json()
        original_value = current["role_defaults"]["satis"]["vehicles_price_view"]
        
        # Toggle a value
        new_value = not original_value
        updated_defaults = current["role_defaults"].copy()
        updated_defaults["satis"]["vehicles_price_view"] = new_value
        
        # Save
        put_response = requests.put(
            f"{BASE_URL}/api/permissions",
            json={"role_defaults": updated_defaults},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert put_response.status_code == 200, f"Failed to update permissions: {put_response.text}"
        
        # Verify it was saved
        verify_response = requests.get(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        verify_data = verify_response.json()
        assert verify_data["role_defaults"]["satis"]["vehicles_price_view"] == new_value, "Value not saved"
        
        # Restore original
        updated_defaults["satis"]["vehicles_price_view"] = original_value
        requests.put(
            f"{BASE_URL}/api/permissions",
            json={"role_defaults": updated_defaults},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"SUCCESS: PUT role_defaults works. Toggled vehicles_price_view: {original_value} -> {new_value} -> {original_value}")
    
    def test_put_permissions_user_overrides(self, admin_token, satis_user_info):
        """PUT /api/permissions should save user_overrides"""
        satis_id = satis_user_info.get("id")
        
        # Get current permissions
        get_response = requests.get(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        current = get_response.json()
        original_overrides = current.get("user_overrides", {}).copy()
        
        # Set a user override
        new_overrides = original_overrides.copy()
        new_overrides[satis_id] = {"vehicles_delete": True, "reports_view": True}
        
        # Save
        put_response = requests.put(
            f"{BASE_URL}/api/permissions",
            json={"user_overrides": new_overrides},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert put_response.status_code == 200, f"Failed to update user_overrides: {put_response.text}"
        
        # Verify it was saved
        verify_response = requests.get(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        verify_data = verify_response.json()
        assert satis_id in verify_data["user_overrides"], "User override not saved"
        assert verify_data["user_overrides"][satis_id]["vehicles_delete"] == True
        assert verify_data["user_overrides"][satis_id]["reports_view"] == True
        
        print(f"SUCCESS: PUT user_overrides works for user {satis_id}")
        
        # Cleanup: restore original
        requests.put(
            f"{BASE_URL}/api/permissions",
            json={"user_overrides": original_overrides},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_satis_cannot_update_permissions(self, satis_token):
        """Non-admin users should get 403 when trying to update permissions"""
        response = requests.put(
            f"{BASE_URL}/api/permissions",
            json={"role_defaults": {"satis": {"vehicles_view": True}}},
            headers={"Authorization": f"Bearer {satis_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Satis user correctly denied from updating permissions")


class TestCustomersOrgVisibility:
    """Test customers are also visible across org"""
    
    def test_admin_creates_customer_satis_can_see(self, admin_token, satis_token):
        """Admin creates customer, satis should see it"""
        customer_data = {
            "name": "TEST_OrgCustomer",
            "phone": "5551234567",
            "type": "Potansiyel",
            "notes": "Test customer for org visibility"
        }
        
        # Create as admin
        create_response = requests.post(
            f"{BASE_URL}/api/customers",
            json=customer_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200
        customer_id = create_response.json()["id"]
        
        try:
            # Satis fetches customers
            satis_response = requests.get(
                f"{BASE_URL}/api/customers",
                headers={"Authorization": f"Bearer {satis_token}"}
            )
            assert satis_response.status_code == 200
            customers = satis_response.json()
            
            test_customer = next((c for c in customers if c["id"] == customer_id), None)
            assert test_customer is not None, "Satis cannot see customer created by admin"
            print(f"SUCCESS: Satis can see customer created by admin")
            
        finally:
            requests.delete(
                f"{BASE_URL}/api/customers/{customer_id}?permanent=true",
                headers={"Authorization": f"Bearer {admin_token}"}
            )


class TestEmployeesEndpoint:
    """Test /api/employees endpoint for permission page user list"""
    
    def test_get_employees_returns_non_admin(self, admin_token):
        """GET /api/employees should return employees with role info"""
        response = requests.get(
            f"{BASE_URL}/api/employees",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        employees = response.json()
        
        # Should have satis user
        satis_emp = next((e for e in employees if e.get("email") == SATIS_EMAIL), None)
        assert satis_emp is not None, "Satis user not in employees list"
        assert satis_emp.get("role") == "satis", "Satis role incorrect"
        
        # Each employee should have required fields
        for emp in employees:
            assert "id" in emp, "Missing id"
            assert "email" in emp, "Missing email"
            assert "name" in emp, "Missing name"
            assert "role" in emp, "Missing role"
        
        print(f"SUCCESS: Got {len(employees)} employees with role info")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
