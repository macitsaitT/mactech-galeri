"""
Test cases for Aslanbaş Oto CRM API
Testing: Cars CRUD, Authentication, Province/District fields
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://image-gallery-live.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "demo@aslanbasoto.com"
TEST_PASSWORD = "demo123"


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_health_check(self):
        """Test API health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
        return data["token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login rejected correctly")


class TestCars:
    """Car CRUD tests with province/district fields"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_cars(self, auth_headers):
        """Test getting all cars"""
        response = requests.get(f"{BASE_URL}/api/cars", headers=auth_headers)
        assert response.status_code == 200
        cars = response.json()
        assert isinstance(cars, list)
        print(f"✓ Got {len(cars)} cars")
        return cars
    
    def test_create_car_with_province_district(self, auth_headers):
        """Test creating a car with province and district fields"""
        car_data = {
            "brand": "BMW",
            "model": "3 Serisi",
            "year": 2024,
            "plate": "TEST_34ABC123",
            "km": "25000",
            "vehicle_type": "Sedan",
            "purchase_price": 1500000,
            "sale_price": 1750000,
            "description": "Test car with province/district",
            "status": "Stokta",
            "fuel_type": "Benzin",
            "gear": "Otomatik",
            "ownership": "stock",
            "package_info": "M Sport",
            "engine_type": "2.0 TSI",
            "province": "İstanbul",
            "district": "Kadıköy"
        }
        
        response = requests.post(f"{BASE_URL}/api/cars", headers=auth_headers, json=car_data)
        assert response.status_code == 200
        
        created_car = response.json()
        assert created_car["brand"] == "BMW"
        assert created_car["model"] == "3 Serisi"
        assert created_car["province"] == "İstanbul"
        assert created_car["district"] == "Kadıköy"
        assert created_car["package_info"] == "M Sport"
        assert created_car["engine_type"] == "2.0 TSI"
        assert "id" in created_car
        
        print(f"✓ Created car with province={created_car['province']}, district={created_car['district']}")
        return created_car["id"]
    
    def test_update_car_province_district(self, auth_headers):
        """Test updating car with new province/district"""
        # First create a test car
        car_data = {
            "brand": "Mercedes-Benz",
            "model": "C Serisi",
            "year": 2023,
            "plate": "TEST_06XYZ789",
            "km": "15000",
            "purchase_price": 2000000,
            "sale_price": 2300000,
            "province": "Ankara",
            "district": "Çankaya"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/cars", headers=auth_headers, json=car_data)
        assert create_resp.status_code == 200
        car_id = create_resp.json()["id"]
        
        # Update with new province/district
        update_data = {
            "brand": "Mercedes-Benz",
            "model": "C Serisi",
            "year": 2023,
            "plate": "TEST_06XYZ789",
            "km": "15000",
            "purchase_price": 2000000,
            "sale_price": 2300000,
            "province": "İzmir",
            "district": "Konak"
        }
        
        update_resp = requests.put(f"{BASE_URL}/api/cars/{car_id}", headers=auth_headers, json=update_data)
        assert update_resp.status_code == 200
        
        updated_car = update_resp.json()
        assert updated_car["province"] == "İzmir"
        assert updated_car["district"] == "Konak"
        
        # Verify with GET
        get_resp = requests.get(f"{BASE_URL}/api/cars", headers=auth_headers)
        cars = get_resp.json()
        found_car = next((c for c in cars if c["id"] == car_id), None)
        assert found_car is not None
        assert found_car["province"] == "İzmir"
        
        print(f"✓ Updated car province to {updated_car['province']}, district to {updated_car['district']}")
        return car_id
    
    def test_create_car_all_fields(self, auth_headers):
        """Test creating car with all new fields (model year, engine, package)"""
        car_data = {
            "brand": "Volkswagen",
            "model": "Golf",
            "year": 2020,  # Model year
            "plate": "TEST_35DEF456",
            "km": "50000",
            "vehicle_type": "Hatchback",
            "purchase_price": 800000,
            "sale_price": 950000,
            "fuel_type": "Dizel",
            "gear": "DSG (Çift Kavrama)",
            "ownership": "stock",
            "engine_type": "1.6 TDI",
            "package_info": "Highline",
            "province": "Bursa",
            "district": "Nilüfer"
        }
        
        response = requests.post(f"{BASE_URL}/api/cars", headers=auth_headers, json=car_data)
        assert response.status_code == 200
        
        car = response.json()
        assert car["year"] == 2020
        assert car["engine_type"] == "1.6 TDI"
        assert car["package_info"] == "Highline"
        assert car["province"] == "Bursa"
        
        print(f"✓ Created car with all fields - Year: {car['year']}, Engine: {car['engine_type']}, Package: {car['package_info']}")
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
            return {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
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
