"""
Test suite for Permissions Management System
Tests:
- GET /api/permissions (returns default permissions)
- PUT /api/permissions (admin only update)
- Non-admin 403 restriction
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://galeri.mactech.tr').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@mactech.tr"
ADMIN_PASSWORD = "password"

@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert data.get("user", {}).get("role") == "admin", "User is not admin"
    return data["token"]

@pytest.fixture(scope="module")
def satis_user_and_token(admin_token):
    """Create a satis user and return token"""
    test_email = f"TEST_satis_{uuid.uuid4().hex[:8]}@test.com"
    
    # Create satis user with admin token
    create_resp = requests.post(
        f"{BASE_URL}/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "email": test_email,
            "password": "testpass123",
            "company_name": "Test Satis User",
            "phone": "5551234567",
            "role": "satis"
        }
    )
    assert create_resp.status_code == 200, f"Failed to create satis user: {create_resp.text}"
    user_data = create_resp.json()
    user_id = user_data["id"]
    
    # Login as satis user
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": test_email,
        "password": "testpass123"
    })
    assert login_resp.status_code == 200, f"Satis login failed: {login_resp.text}"
    login_data = login_resp.json()
    assert login_data.get("user", {}).get("role") == "satis", "User role should be satis"
    
    yield {
        "user_id": user_id,
        "email": test_email,
        "token": login_data["token"]
    }
    
    # Cleanup - delete the test user
    requests.delete(
        f"{BASE_URL}/api/users/{user_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )

class TestPermissionsAPI:
    """Tests for permissions API endpoints"""
    
    def test_get_permissions_returns_default(self, admin_token):
        """GET /api/permissions should return default permissions for org"""
        response = requests.get(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"GET permissions failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "org_id" in data, "Response should contain org_id"
        assert "permissions" in data, "Response should contain permissions"
        
        perms = data["permissions"]
        
        # Verify both roles exist
        assert "muhasebe" in perms, "Muhasebe permissions should exist"
        assert "satis" in perms, "Satis permissions should exist"
        
        # Verify some permission keys exist
        assert "vehicles_view" in perms["muhasebe"], "vehicles_view should exist for muhasebe"
        assert "vehicles_view" in perms["satis"], "vehicles_view should exist for satis"
        assert "transactions_view" in perms["muhasebe"], "transactions_view should exist for muhasebe"
        assert "reports_view" in perms["muhasebe"], "reports_view should exist for muhasebe"
        
        print(f"GET permissions passed - muhasebe keys: {list(perms['muhasebe'].keys())}")
        print(f"GET permissions passed - satis keys: {list(perms['satis'].keys())}")
    
    def test_admin_can_update_permissions(self, admin_token):
        """PUT /api/permissions should work for admin"""
        # First get current permissions
        get_resp = requests.get(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_resp.status_code == 200
        original_perms = get_resp.json()["permissions"]
        
        # Modify a permission
        modified_perms = {
            "muhasebe": {**original_perms.get("muhasebe", {}), "vehicles_add": True},
            "satis": {**original_perms.get("satis", {}), "reports_view": True}
        }
        
        # Update permissions
        update_resp = requests.put(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"permissions": modified_perms}
        )
        assert update_resp.status_code == 200, f"PUT permissions failed: {update_resp.text}"
        data = update_resp.json()
        assert data.get("success") == True, "Update should return success: true"
        assert "permissions" in data, "Update should return permissions"
        
        # Verify changes persisted
        verify_resp = requests.get(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()["permissions"]
        assert verify_data["muhasebe"]["vehicles_add"] == True, "muhasebe vehicles_add should be True"
        assert verify_data["satis"]["reports_view"] == True, "satis reports_view should be True"
        
        # Restore original permissions
        restore_resp = requests.put(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"permissions": original_perms}
        )
        assert restore_resp.status_code == 200, "Failed to restore original permissions"
        
        print("Admin UPDATE permissions passed - changes persisted and verified")
    
    def test_non_admin_cannot_update_permissions(self, satis_user_and_token):
        """PUT /api/permissions should return 403 for non-admin users"""
        satis_token = satis_user_and_token["token"]
        
        update_resp = requests.put(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {satis_token}"},
            json={"permissions": {"muhasebe": {"vehicles_add": True}, "satis": {}}}
        )
        
        assert update_resp.status_code == 403, f"Non-admin should get 403, got {update_resp.status_code}: {update_resp.text}"
        print(f"Non-admin 403 restriction passed - satis user blocked from updating permissions")
    
    def test_satis_can_read_permissions(self, satis_user_and_token):
        """GET /api/permissions should work for non-admin users too"""
        satis_token = satis_user_and_token["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {satis_token}"}
        )
        assert response.status_code == 200, f"Satis should be able to GET permissions: {response.text}"
        data = response.json()
        assert "permissions" in data, "Response should contain permissions"
        print(f"Satis user can read permissions - passed")

class TestPermissionKeys:
    """Test that all required permission keys exist"""
    
    REQUIRED_PERMISSION_KEYS = [
        "vehicles_view", "vehicles_add", "vehicles_edit", "vehicles_delete", "vehicles_sell", "vehicles_price_view",
        "customers_view", "customers_add", "customers_edit", "customers_delete",
        "transactions_view", "transactions_add", "transactions_edit", "transactions_delete",
        "reports_view",
        "appointments_view", "appointments_add", "appointments_edit", "appointments_delete",
        "dashboard_view", "trash_view",
    ]
    
    def test_all_permission_keys_exist(self, admin_token):
        """Verify all 21 permission keys exist for both roles"""
        response = requests.get(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        perms = response.json()["permissions"]
        
        for role in ["muhasebe", "satis"]:
            role_perms = perms.get(role, {})
            for key in self.REQUIRED_PERMISSION_KEYS:
                assert key in role_perms, f"Permission key '{key}' missing for role '{role}'"
        
        print(f"All 21 permission keys exist for both roles - PASSED")

class TestPermissionGroups:
    """Test permission organization by groups"""
    
    PERMISSION_GROUPS = {
        "Araçlar": ["vehicles_view", "vehicles_add", "vehicles_edit", "vehicles_delete", "vehicles_sell", "vehicles_price_view"],
        "Müşteriler": ["customers_view", "customers_add", "customers_edit", "customers_delete"],
        "Finansal İşlemler": ["transactions_view", "transactions_add", "transactions_edit", "transactions_delete"],
        "Raporlar": ["reports_view"],
        "Randevular": ["appointments_view", "appointments_add", "appointments_edit", "appointments_delete"],
    }
    
    def test_permission_groups_coverage(self, admin_token):
        """Test that permission groups match backend keys"""
        response = requests.get(
            f"{BASE_URL}/api/permissions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        perms = response.json()["permissions"]
        
        # Count keys covered by groups
        covered_keys = set()
        for group_name, keys in self.PERMISSION_GROUPS.items():
            for key in keys:
                assert key in perms["muhasebe"], f"Group '{group_name}' key '{key}' not in muhasebe perms"
                covered_keys.add(key)
        
        print(f"Permission groups cover {len(covered_keys)} keys - PASSED")

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
