"""
SSO (Single Sign-On) Login Tests
Tests for MACTech SSO integration - /api/auth/sso-login endpoint
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSSOLogin:
    """SSO Login endpoint tests"""
    
    def test_sso_login_without_token(self):
        """POST /api/auth/sso-login without sso_token should return 400"""
        response = requests.post(f"{BASE_URL}/api/auth/sso-login", json={})
        assert response.status_code == 400
        data = response.json()
        assert "sso_token gerekli" in data.get("detail", "")
        print("✓ SSO login without token returns 400")
    
    def test_sso_login_with_empty_token(self):
        """POST /api/auth/sso-login with empty sso_token should return 400"""
        response = requests.post(f"{BASE_URL}/api/auth/sso-login", json={"sso_token": ""})
        assert response.status_code == 400
        data = response.json()
        assert "sso_token gerekli" in data.get("detail", "")
        print("✓ SSO login with empty token returns 400")
    
    def test_sso_login_with_invalid_token(self):
        """POST /api/auth/sso-login with invalid token should return 401 or 503"""
        # mactech.tr API is not ready, so we expect either:
        # - 401 (invalid token)
        # - 503 (connection error to mactech.tr)
        response = requests.post(f"{BASE_URL}/api/auth/sso-login", json={"sso_token": "invalid_test_token_12345"})
        # Should not be 200 (success) or 400 (missing token)
        assert response.status_code in [401, 503], f"Expected 401 or 503, got {response.status_code}"
        print(f"✓ SSO login with invalid token returns {response.status_code}")
    
    def test_sso_endpoint_exists(self):
        """POST /api/auth/sso-login endpoint should exist (not 404)"""
        response = requests.post(f"{BASE_URL}/api/auth/sso-login", json={"sso_token": "test"})
        assert response.status_code != 404, "SSO endpoint should exist"
        print("✓ SSO endpoint exists (not 404)")


class TestNormalLogin:
    """Normal email/password login tests - ensure SSO didn't break existing auth"""
    
    @pytest.fixture
    def test_user_email(self):
        return f"sso_test_{uuid.uuid4().hex[:8]}@test.com"
    
    def test_register_new_user(self, test_user_email):
        """POST /api/auth/register should still work"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_user_email,
            "password": "testpass123",
            "company_name": "SSO Test Company",
            "phone": "0532 111 22 33"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == test_user_email
        print(f"✓ Register new user works: {test_user_email}")
        return data
    
    def test_login_with_credentials(self, test_user_email):
        """POST /api/auth/login should still work"""
        # First register
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_user_email,
            "password": "testpass123",
            "company_name": "SSO Test Company",
            "phone": "0532 111 22 33"
        })
        assert reg_response.status_code == 200
        
        # Then login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_user_email,
            "password": "testpass123"
        })
        assert login_response.status_code == 200
        data = login_response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Login with credentials works: {test_user_email}")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with wrong password should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Login with invalid credentials returns 401")


class TestQRLogin:
    """QR Login tests - ensure SSO didn't break QR login"""
    
    def test_generate_qr_session(self):
        """POST /api/auth/qr/generate should work"""
        response = requests.post(f"{BASE_URL}/api/auth/qr/generate")
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert "expires_in" in data
        print(f"✓ QR session generated: {data['session_id'][:8]}...")
        return data["session_id"]
    
    def test_check_qr_status(self):
        """GET /api/auth/qr/status/{session_id} should work"""
        # First generate a session
        gen_response = requests.post(f"{BASE_URL}/api/auth/qr/generate")
        assert gen_response.status_code == 200
        session_id = gen_response.json()["session_id"]
        
        # Check status
        status_response = requests.get(f"{BASE_URL}/api/auth/qr/status/{session_id}")
        assert status_response.status_code == 200
        data = status_response.json()
        assert data["status"] == "pending"
        print(f"✓ QR status check works: {data['status']}")
    
    def test_check_invalid_qr_session(self):
        """GET /api/auth/qr/status/{invalid_id} should return 404"""
        response = requests.get(f"{BASE_URL}/api/auth/qr/status/invalid-session-id")
        assert response.status_code == 404
        print("✓ Invalid QR session returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
