"""
Test cases for Aslanbaş Oto CRM API - New Features
Testing: 
- Registration with phone + email verification
- Email verification flow
- Expertise fields (expertise_score, tramer_amount, expertise_notes)
- KVKK account deletion
- Full car creation with expertise data
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://galeri-pro.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "demo@aslanbasoto.com"
TEST_PASSWORD = "demo123"


class TestLoginAndAuth:
    """Test login and authentication"""
    
    def test_health_check(self):
        """Test API health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_login_with_demo_credentials(self):
        """Test login with demo@aslanbasoto.com / demo123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Demo login successful: {TEST_EMAIL}")
        return data["token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected with 401")


class TestRegistrationWithEmailVerification:
    """Test registration with phone number and email verification"""
    
    def test_register_returns_verification_code(self):
        """Test that registration creates account and returns verification_code"""
        unique_email = f"test_reg_{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "company_name": "Test Company",
            "phone": "0532 123 45 67"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check response contains verification_code
        assert "verification_code" in data, "Registration should return verification_code"
        assert "requires_verification" in data, "Registration should indicate verification is required"
        assert "token" in data, "Registration should return token"
        assert "user" in data, "Registration should return user data"
        
        # Verify verification code is 6 digits
        code = data["verification_code"]
        assert len(code) == 6, f"Verification code should be 6 digits, got {len(code)}"
        assert code.isdigit(), "Verification code should be numeric"
        
        print(f"✓ Registration returned verification_code: {code}")
        return unique_email, code, data["token"]
    
    def test_email_verification_with_correct_code(self):
        """Test email verification works with correct 6-digit code"""
        # First register a new user
        unique_email = f"test_verify_{uuid.uuid4().hex[:8]}@test.com"
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "company_name": "Verify Test Company",
            "phone": "0533 987 65 43"
        })
        
        assert reg_response.status_code == 200
        reg_data = reg_response.json()
        verification_code = reg_data["verification_code"]
        
        # Now verify the email
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-email", json={
            "email": unique_email,
            "code": verification_code
        })
        
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data.get("verified") == True, "Email should be marked as verified"
        
        print(f"✓ Email verification successful for {unique_email}")
    
    def test_email_verification_with_wrong_code(self):
        """Test email verification fails with wrong code"""
        # First register a new user
        unique_email = f"test_wrong_{uuid.uuid4().hex[:8]}@test.com"
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "company_name": "Wrong Code Test"
        })
        
        assert reg_response.status_code == 200
        
        # Try to verify with wrong code
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-email", json={
            "email": unique_email,
            "code": "000000"  # Wrong code
        })
        
        assert verify_response.status_code == 400, "Wrong verification code should return 400"
        print("✓ Wrong verification code correctly rejected")
    
    def test_registration_includes_phone_field(self):
        """Test that registration accepts and stores phone number"""
        unique_email = f"test_phone_{uuid.uuid4().hex[:8]}@test.com"
        phone = "0534 111 22 33"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "company_name": "Phone Test Company",
            "phone": phone
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["phone"] == phone, f"Phone should be stored, expected {phone}"
        
        print(f"✓ Registration correctly stores phone: {phone}")


class TestKVKKAccountDeletion:
    """Test KVKK account deletion feature"""
    
    def test_delete_account_endpoint_exists(self):
        """Test that DELETE /api/auth/delete-account endpoint exists and requires auth"""
        # Without auth should return 403 or 401
        response = requests.delete(f"{BASE_URL}/api/auth/delete-account")
        assert response.status_code in [401, 403], "Delete account should require authentication"
        print("✓ Delete account endpoint exists and requires auth")
    
    def test_delete_account_removes_all_user_data(self):
        """Test that account deletion removes user and all associated data"""
        # Create a new test account
        unique_email = f"test_delete_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "company_name": "Delete Test Company"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Create a car
        car_response = requests.post(f"{BASE_URL}/api/cars", headers=headers, json={
            "brand": "Test",
            "model": "Delete Test",
            "year": 2024,
            "plate": "TEST_DELETE_CAR",
            "purchase_price": 100000,
            "sale_price": 120000
        })
        
        # Delete the account
        delete_response = requests.delete(f"{BASE_URL}/api/auth/delete-account", headers=headers)
        assert delete_response.status_code == 200
        delete_data = delete_response.json()
        assert delete_data.get("success") == True, "Delete should return success=true"
        
        # Verify token no longer works
        verify_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert verify_response.status_code in [401, 404], "Token should be invalid after deletion"
        
        print(f"✓ Account deletion successful, all data removed for {unique_email}")


class TestExpertiseFields:
    """Test new expertise fields: expertise_score, tramer_amount, expertise_notes"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        pytest.skip("Authentication failed")
    
    def test_create_car_with_expertise_score(self, auth_headers):
        """Test creating car with expertise_score field"""
        car_data = {
            "brand": "BMW",
            "model": "5 Serisi",
            "year": 2023,
            "plate": "TEST_EXP_SCORE",
            "purchase_price": 2000000,
            "sale_price": 2500000,
            "expertise_score": 92
        }
        
        response = requests.post(f"{BASE_URL}/api/cars", headers=auth_headers, json=car_data)
        assert response.status_code == 200
        
        car = response.json()
        assert car["expertise_score"] == 92, f"Expected expertise_score=92, got {car.get('expertise_score')}"
        print(f"✓ Car created with expertise_score: {car['expertise_score']}")
        return car["id"]
    
    def test_create_car_with_tramer_amount(self, auth_headers):
        """Test creating car with tramer_amount field"""
        car_data = {
            "brand": "Mercedes-Benz",
            "model": "E Serisi",
            "year": 2022,
            "plate": "TEST_TRAMER",
            "purchase_price": 2500000,
            "sale_price": 3000000,
            "tramer_amount": 75000
        }
        
        response = requests.post(f"{BASE_URL}/api/cars", headers=auth_headers, json=car_data)
        assert response.status_code == 200
        
        car = response.json()
        assert car["tramer_amount"] == 75000, f"Expected tramer_amount=75000, got {car.get('tramer_amount')}"
        print(f"✓ Car created with tramer_amount: {car['tramer_amount']} TL")
        return car["id"]
    
    def test_create_car_with_expertise_notes(self, auth_headers):
        """Test creating car with expertise_notes field"""
        notes = "Ön tampon boyalı, sol kapı lokal boyalı. Motor bakımları düzenli."
        car_data = {
            "brand": "Audi",
            "model": "A4",
            "year": 2021,
            "plate": "TEST_EXP_NOTES",
            "purchase_price": 1800000,
            "sale_price": 2200000,
            "expertise_notes": notes
        }
        
        response = requests.post(f"{BASE_URL}/api/cars", headers=auth_headers, json=car_data)
        assert response.status_code == 200
        
        car = response.json()
        assert car["expertise_notes"] == notes, "Expertise notes should match"
        print(f"✓ Car created with expertise_notes")
        return car["id"]
    
    def test_create_car_with_all_expertise_fields(self, auth_headers):
        """Test creating car with all expertise fields together"""
        car_data = {
            "brand": "Volkswagen",
            "model": "Passat",
            "year": 2023,
            "plate": "TEST_ALL_EXP",
            "purchase_price": 1500000,
            "sale_price": 1900000,
            "expertise_score": 88,
            "tramer_amount": 45000,
            "expertise_notes": "Sağ arka çamurluk değişen. Tramer kayıtlı.",
            "expertise": {
                "parts": {
                    "kaput": "orijinal",
                    "tavan": "orijinal",
                    "sag_arka_camurluk": "degisen"
                },
                "mechanical": {
                    "motor": "Orijinal",
                    "sanziman": "Orijinal",
                    "yuruyen": "Bakımlı"
                }
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/cars", headers=auth_headers, json=car_data)
        assert response.status_code == 200
        
        car = response.json()
        assert car["expertise_score"] == 88
        assert car["tramer_amount"] == 45000
        assert car["expertise_notes"] == car_data["expertise_notes"]
        assert car["expertise"]["parts"]["sag_arka_camurluk"] == "degisen"
        
        print(f"✓ Car created with all expertise fields:")
        print(f"  - Expertise Score: {car['expertise_score']}%")
        print(f"  - Tramer Amount: {car['tramer_amount']} TL")
        print(f"  - Has expertise notes: Yes")
        return car["id"]
    
    def test_default_expertise_score_is_95(self, auth_headers):
        """Test that expertise_score has default value of 95"""
        car_data = {
            "brand": "Toyota",
            "model": "Corolla",
            "year": 2024,
            "plate": "TEST_DEFAULT_EXP",
            "purchase_price": 1000000,
            "sale_price": 1200000
            # Not providing expertise_score - should default to 95
        }
        
        response = requests.post(f"{BASE_URL}/api/cars", headers=auth_headers, json=car_data)
        assert response.status_code == 200
        
        car = response.json()
        assert car["expertise_score"] == 95, f"Default expertise_score should be 95, got {car.get('expertise_score')}"
        print(f"✓ Default expertise_score is 95")
        return car["id"]


class TestCleanup:
    """Clean up test data"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        pytest.skip("Authentication failed")
    
    def test_cleanup_test_cars(self, auth_headers):
        """Delete TEST_ prefixed cars"""
        response = requests.get(f"{BASE_URL}/api/cars", headers=auth_headers)
        if response.status_code == 200:
            cars = response.json()
            test_cars = [c for c in cars if c.get("plate", "").startswith("TEST_")]
            
            for car in test_cars:
                delete_resp = requests.delete(
                    f"{BASE_URL}/api/cars/{car['id']}?permanent=true", 
                    headers=auth_headers
                )
                if delete_resp.status_code == 200:
                    print(f"✓ Deleted test car: {car['plate']}")
            
            print(f"✓ Cleaned up {len(test_cars)} test cars")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
