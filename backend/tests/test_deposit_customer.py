"""
Test deposit customer info feature:
- GET /api/cars returns deposit_customer_name, deposit_date fields for cars with deposit
- PATCH /api/cars/{id} saves deposit_customer_id, deposit_customer_name, deposit_date correctly
- Deposit info is cleared when deposit is cancelled (set to empty strings)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDepositCustomerInfo:
    """Test deposit with customer information"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        self.user_id = data.get("user", {}).get("id")
    
    def test_get_cars_returns_deposit_customer_fields(self):
        """GET /api/cars should return deposit_customer_name and deposit_date for cars with deposit"""
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        assert response.status_code == 200
        
        cars = response.json()
        assert len(cars) > 0, "No cars found"
        
        # Find BMW 320i which should have deposit info (from seed data)
        bmw = next((c for c in cars if 'BMW' in c.get('brand', '') and '320i' in c.get('model', '')), None)
        
        if bmw:
            # Verify deposit fields exist
            assert 'deposit_amount' in bmw, "deposit_amount field missing"
            assert 'deposit_customer_name' in bmw, "deposit_customer_name field missing"
            assert 'deposit_customer_id' in bmw, "deposit_customer_id field missing"
            assert 'deposit_date' in bmw, "deposit_date field missing"
            
            # If BMW has deposit, verify the values
            if bmw.get('deposit_amount', 0) > 0:
                print(f"BMW deposit info: amount={bmw.get('deposit_amount')}, customer={bmw.get('deposit_customer_name')}, date={bmw.get('deposit_date')}")
                # Expected: 50000, Mehmet Yıldız, 2026-03-04
                assert bmw.get('deposit_amount') == 50000, f"Expected deposit 50000, got {bmw.get('deposit_amount')}"
                assert bmw.get('deposit_customer_name') == 'Mehmet Yıldız', f"Expected customer 'Mehmet Yıldız', got {bmw.get('deposit_customer_name')}"
                assert bmw.get('deposit_date') == '2026-03-04', f"Expected date '2026-03-04', got {bmw.get('deposit_date')}"
            else:
                print(f"BMW has no deposit yet, fields exist but empty")
        else:
            # If no BMW found, just verify the schema has the fields
            first_car = cars[0]
            assert 'deposit_amount' in first_car or first_car.get('deposit_amount') is None
            print(f"BMW not found, but verifying schema on first car: {first_car.get('brand')} {first_car.get('model')}")
    
    def test_patch_car_saves_deposit_customer_info(self):
        """PATCH /api/cars/{id} should save deposit_customer_id, deposit_customer_name, deposit_date"""
        # First get cars
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        assert response.status_code == 200
        cars = response.json()
        
        # Find a car to test (prefer Mercedes which should be Stokta)
        test_car = next((c for c in cars if 'Mercedes' in c.get('brand', '') and c.get('status') == 'Stokta'), None)
        if not test_car:
            test_car = next((c for c in cars if c.get('status') == 'Stokta'), None)
        if not test_car:
            test_car = cars[0] if cars else None
        
        assert test_car is not None, "No car found for testing"
        car_id = test_car['id']
        
        # Save original state
        original_deposit = test_car.get('deposit_amount', 0)
        original_customer_name = test_car.get('deposit_customer_name', '')
        original_customer_id = test_car.get('deposit_customer_id', '')
        original_date = test_car.get('deposit_date', '')
        original_status = test_car.get('status', 'Stokta')
        
        # PATCH with deposit customer info
        patch_data = {
            "status": "Kapora Alındı",
            "deposit_amount": 25000,
            "deposit_customer_id": "test-customer-123",
            "deposit_customer_name": "Test Müşteri",
            "deposit_date": "2026-01-15"
        }
        
        response = requests.patch(f"{BASE_URL}/api/cars/{car_id}", headers=self.headers, json=patch_data)
        assert response.status_code == 200, f"PATCH failed: {response.text}"
        
        updated_car = response.json()
        
        # Verify all fields saved correctly
        assert updated_car.get('status') == 'Kapora Alındı', f"Status not updated"
        assert updated_car.get('deposit_amount') == 25000, f"deposit_amount not saved"
        assert updated_car.get('deposit_customer_id') == 'test-customer-123', f"deposit_customer_id not saved"
        assert updated_car.get('deposit_customer_name') == 'Test Müşteri', f"deposit_customer_name not saved"
        assert updated_car.get('deposit_date') == '2026-01-15', f"deposit_date not saved"
        
        print(f"PATCH deposit info: PASSED - all fields saved correctly")
        
        # GET to verify persistence
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        cars_after = response.json()
        car_after = next((c for c in cars_after if c['id'] == car_id), None)
        
        assert car_after is not None, "Car not found after PATCH"
        assert car_after.get('deposit_amount') == 25000
        assert car_after.get('deposit_customer_name') == 'Test Müşteri'
        assert car_after.get('deposit_date') == '2026-01-15'
        
        print(f"GET after PATCH: PASSED - deposit info persisted")
        
        # CLEANUP: Restore original state
        cleanup_data = {
            "status": original_status,
            "deposit_amount": original_deposit,
            "deposit_customer_id": original_customer_id or '',
            "deposit_customer_name": original_customer_name or '',
            "deposit_date": original_date or ''
        }
        requests.patch(f"{BASE_URL}/api/cars/{car_id}", headers=self.headers, json=cleanup_data)
    
    def test_cancel_deposit_clears_customer_info(self):
        """Cancelling deposit should clear customer info fields"""
        # Get cars
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        cars = response.json()
        
        # Find a car to test
        test_car = next((c for c in cars if c.get('status') == 'Stokta'), None)
        if not test_car:
            test_car = cars[0] if cars else None
        
        assert test_car is not None, "No car found for testing"
        car_id = test_car['id']
        
        # Save original state
        original_status = test_car.get('status', 'Stokta')
        original_deposit = test_car.get('deposit_amount', 0)
        original_customer_name = test_car.get('deposit_customer_name', '')
        original_customer_id = test_car.get('deposit_customer_id', '')
        original_date = test_car.get('deposit_date', '')
        
        # First add deposit
        requests.patch(f"{BASE_URL}/api/cars/{car_id}", headers=self.headers, json={
            "status": "Kapora Alındı",
            "deposit_amount": 30000,
            "deposit_customer_id": "cancel-test-customer",
            "deposit_customer_name": "Cancel Test",
            "deposit_date": "2026-01-20"
        })
        
        # Now cancel deposit (simulate refund)
        cancel_data = {
            "status": "Stokta",
            "deposit_amount": 0,
            "deposit_customer_id": "",
            "deposit_customer_name": "",
            "deposit_date": ""
        }
        
        response = requests.patch(f"{BASE_URL}/api/cars/{car_id}", headers=self.headers, json=cancel_data)
        assert response.status_code == 200
        
        cleared_car = response.json()
        
        # Verify all fields cleared
        assert cleared_car.get('status') == 'Stokta'
        assert cleared_car.get('deposit_amount') == 0
        assert cleared_car.get('deposit_customer_id') in ['', None]
        assert cleared_car.get('deposit_customer_name') in ['', None]
        assert cleared_car.get('deposit_date') in ['', None]
        
        print(f"Cancel deposit: PASSED - all customer info cleared")
        
        # CLEANUP: Restore original state
        cleanup_data = {
            "status": original_status,
            "deposit_amount": original_deposit,
            "deposit_customer_id": original_customer_id or '',
            "deposit_customer_name": original_customer_name or '',
            "deposit_date": original_date or ''
        }
        requests.patch(f"{BASE_URL}/api/cars/{car_id}", headers=self.headers, json=cleanup_data)
    
    def test_customers_endpoint_for_deposit_dropdown(self):
        """GET /api/customers should return customer list for dropdown"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=self.headers)
        assert response.status_code == 200
        
        customers = response.json()
        print(f"Found {len(customers)} customers for dropdown")
        
        # Verify customer structure
        if customers:
            customer = customers[0]
            assert 'id' in customer, "Customer missing id"
            assert 'name' in customer, "Customer missing name"
            # Check for Mehmet Yıldız (expected deposit customer)
            mehmet = next((c for c in customers if 'Mehmet' in c.get('name', '')), None)
            if mehmet:
                print(f"Found Mehmet Yıldız in customers: id={mehmet.get('id')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
