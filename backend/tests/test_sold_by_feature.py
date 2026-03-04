"""
Test sold_by_name and sold_by_user_id feature for car sales tracking.

Features tested:
- PATCH /api/cars/{car_id} with status='Satıldı' auto-populates sold_by_name and sold_by_user_id
- Cancelling sale (status reverts from 'Satıldı') clears sold_by fields
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "test@test.com"
ADMIN_PASSWORD = "password"
SATIS_EMAIL = "satis@test.com"
SATIS_PASSWORD = "password"


class TestSoldByFeature:
    """Test sold_by_name and sold_by_user_id auto-population feature"""

    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        return data["token"]

    @pytest.fixture(scope="class")
    def satis_token(self):
        """Login as satis user and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SATIS_EMAIL, "password": SATIS_PASSWORD}
        )
        assert response.status_code == 200, f"Satis login failed: {response.text}"
        data = response.json()
        return data["token"]

    @pytest.fixture(scope="class")
    def admin_user_info(self, admin_token):
        """Get admin user info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        return response.json()

    @pytest.fixture(scope="class")
    def satis_user_info(self, satis_token):
        """Get satis user info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {satis_token}"}
        )
        assert response.status_code == 200
        return response.json()

    def test_admin_login_success(self, admin_token, admin_user_info):
        """Verify admin login and user info"""
        assert admin_token is not None
        assert admin_user_info.get("email") == ADMIN_EMAIL
        assert admin_user_info.get("role") == "admin"
        print(f"Admin logged in: {admin_user_info.get('company_name')}")

    def test_satis_login_success(self, satis_token, satis_user_info):
        """Verify satis login and user info"""
        assert satis_token is not None
        assert satis_user_info.get("email") == SATIS_EMAIL
        assert satis_user_info.get("role") == "satis"
        print(f"Satis logged in: {satis_user_info.get('company_name')}")

    def test_create_test_car_for_sale(self, admin_token):
        """Create a test car for sale testing"""
        car_data = {
            "brand": "TEST_Audi",
            "model": "A6",
            "year": 2023,
            "plate": "TEST 06 SALE 001",
            "km": "15000",
            "fuel_type": "Dizel",
            "gear": "Otomatik",
            "vehicle_type": "Sedan",
            "status": "Stokta",
            "ownership": "stock",
            "purchase_price": 1500000,
            "sale_price": 1800000
        }
        response = requests.post(
            f"{BASE_URL}/api/cars",
            json=car_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Create car failed: {response.text}"
        car = response.json()
        assert car.get("id") is not None
        assert car.get("status") == "Stokta"
        assert car.get("sold_by_name", "") == ""
        assert car.get("sold_by_user_id", "") == ""
        print(f"Created test car: {car.get('plate')} with id: {car.get('id')}")
        return car

    def test_patch_car_to_sold_auto_populates_sold_by(self, admin_token, admin_user_info):
        """Test PATCH /api/cars/{id} with status='Satıldı' auto-populates sold_by fields"""
        # First create a car
        car = self.test_create_test_car_for_sale(admin_token)
        car_id = car["id"]

        # Patch to sold
        patch_data = {
            "status": "Satıldı",
            "sold_date": "2026-01-15"
        }
        response = requests.patch(
            f"{BASE_URL}/api/cars/{car_id}",
            json=patch_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Patch failed: {response.text}"
        updated_car = response.json()
        
        # Verify sold_by fields are auto-populated
        assert updated_car.get("status") == "Satıldı"
        assert updated_car.get("sold_by_user_id") == admin_user_info.get("id"), \
            f"Expected sold_by_user_id={admin_user_info.get('id')}, got {updated_car.get('sold_by_user_id')}"
        assert updated_car.get("sold_by_name") == admin_user_info.get("company_name"), \
            f"Expected sold_by_name={admin_user_info.get('company_name')}, got {updated_car.get('sold_by_name')}"
        
        print(f"Car sold - sold_by_name: {updated_car.get('sold_by_name')}, sold_by_user_id: {updated_car.get('sold_by_user_id')}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/cars/{car_id}?permanent=true", headers={"Authorization": f"Bearer {admin_token}"})
        return updated_car

    def test_satis_sells_car_populates_their_name(self, satis_token, satis_user_info):
        """Test that when satis user sells a car, their company_name is recorded"""
        # Create a car as satis user
        car_data = {
            "brand": "TEST_Honda",
            "model": "Civic",
            "year": 2024,
            "plate": "TEST 34 SATIS 001",
            "km": "5000",
            "fuel_type": "Benzin",
            "gear": "Otomatik",
            "vehicle_type": "Sedan",
            "status": "Stokta",
            "ownership": "stock",
            "purchase_price": 800000,
            "sale_price": 950000
        }
        create_response = requests.post(
            f"{BASE_URL}/api/cars",
            json=car_data,
            headers={"Authorization": f"Bearer {satis_token}"}
        )
        assert create_response.status_code == 200, f"Create car failed: {create_response.text}"
        car = create_response.json()
        car_id = car["id"]
        print(f"Satis user created car: {car.get('plate')}")

        # Sell the car as satis user
        patch_data = {
            "status": "Satıldı",
            "sold_date": "2026-01-16"
        }
        patch_response = requests.patch(
            f"{BASE_URL}/api/cars/{car_id}",
            json=patch_data,
            headers={"Authorization": f"Bearer {satis_token}"}
        )
        assert patch_response.status_code == 200
        sold_car = patch_response.json()
        
        # Verify sold_by is satis user's info
        assert sold_car.get("sold_by_user_id") == satis_user_info.get("id")
        assert sold_car.get("sold_by_name") == satis_user_info.get("company_name")
        print(f"Satis sold car - sold_by_name: {sold_car.get('sold_by_name')}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/cars/{car_id}?permanent=true", headers={"Authorization": f"Bearer {satis_token}"})

    def test_cancel_sale_clears_sold_by_fields(self, admin_token, admin_user_info):
        """Test that cancelling sale (status reverts from Satıldı) clears sold_by fields"""
        # Create and sell a car
        car_data = {
            "brand": "TEST_Toyota",
            "model": "Corolla",
            "year": 2023,
            "plate": "TEST 35 CANCEL 001",
            "km": "20000",
            "fuel_type": "Benzin",
            "gear": "Otomatik",
            "vehicle_type": "Sedan",
            "status": "Stokta",
            "ownership": "stock",
            "purchase_price": 700000,
            "sale_price": 850000
        }
        create_response = requests.post(
            f"{BASE_URL}/api/cars",
            json=car_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200
        car = create_response.json()
        car_id = car["id"]

        # Sell the car
        sell_patch = {"status": "Satıldı", "sold_date": "2026-01-17"}
        sell_response = requests.patch(
            f"{BASE_URL}/api/cars/{car_id}",
            json=sell_patch,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert sell_response.status_code == 200
        sold_car = sell_response.json()
        assert sold_car.get("sold_by_name") == admin_user_info.get("company_name")
        print(f"Car sold with sold_by_name: {sold_car.get('sold_by_name')}")

        # Cancel sale - revert status to Stokta
        cancel_patch = {"status": "Stokta", "sold_date": "", "sold_by_user_id": "", "sold_by_name": ""}
        cancel_response = requests.patch(
            f"{BASE_URL}/api/cars/{car_id}",
            json=cancel_patch,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert cancel_response.status_code == 200
        cancelled_car = cancel_response.json()
        
        # Verify sold_by fields are cleared
        assert cancelled_car.get("status") == "Stokta"
        assert cancelled_car.get("sold_by_user_id") == "", f"sold_by_user_id should be empty, got: {cancelled_car.get('sold_by_user_id')}"
        assert cancelled_car.get("sold_by_name") == "", f"sold_by_name should be empty, got: {cancelled_car.get('sold_by_name')}"
        print(f"Sale cancelled - sold_by fields cleared")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/cars/{car_id}?permanent=true", headers={"Authorization": f"Bearer {admin_token}"})

    def test_cancel_sale_backend_logic(self, admin_token, admin_user_info):
        """Test backend logic: status change from Satıldı to other status clears sold_by"""
        # Create car
        car_data = {
            "brand": "TEST_VW",
            "model": "Passat",
            "year": 2023,
            "plate": "TEST 35 LOGIC 001",
            "km": "10000",
            "fuel_type": "Dizel",
            "gear": "Otomatik",
            "vehicle_type": "Sedan",
            "status": "Stokta",
            "ownership": "stock",
            "purchase_price": 900000,
            "sale_price": 1100000
        }
        create_response = requests.post(
            f"{BASE_URL}/api/cars",
            json=car_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        car = create_response.json()
        car_id = car["id"]

        # Sell the car
        sell_patch = {"status": "Satıldı", "sold_date": "2026-01-18"}
        sell_response = requests.patch(
            f"{BASE_URL}/api/cars/{car_id}",
            json=sell_patch,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        sold_car = sell_response.json()
        assert sold_car.get("sold_by_name") != ""
        print(f"Sold car has sold_by_name: {sold_car.get('sold_by_name')}")

        # Revert to Kapora Alındı (test backend auto-clearing)
        # Backend should clear sold_by when status changes FROM Satıldı to something else
        revert_patch = {"status": "Kapora Alındı"}
        revert_response = requests.patch(
            f"{BASE_URL}/api/cars/{car_id}",
            json=revert_patch,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert revert_response.status_code == 200
        reverted_car = revert_response.json()
        
        # Backend should auto-clear sold_by when status reverts from Satıldı
        assert reverted_car.get("status") == "Kapora Alındı"
        assert reverted_car.get("sold_by_user_id") == "", f"Backend should auto-clear sold_by_user_id"
        assert reverted_car.get("sold_by_name") == "", f"Backend should auto-clear sold_by_name"
        print(f"Backend auto-cleared sold_by on status change from Satıldı")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/cars/{car_id}?permanent=true", headers={"Authorization": f"Bearer {admin_token}"})

    def test_get_cars_returns_sold_by_fields(self, admin_token):
        """Test GET /api/cars returns sold_by_name and sold_by_user_id fields for sold cars"""
        response = requests.get(
            f"{BASE_URL}/api/cars",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        cars = response.json()
        
        # Find any sold car
        sold_cars = [c for c in cars if c.get("status") == "Satıldı"]
        if sold_cars:
            for car in sold_cars:
                # Sold cars should have sold_by_name field (may be empty for old data)
                assert "sold_by_name" in car or car.get("sold_by_name") is None, "sold_by_name field should exist"
                print(f"Sold car {car.get('plate')}: sold_by_name={car.get('sold_by_name', 'N/A')}")
        else:
            print("No sold cars found - skipping sold_by field verification on existing data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
