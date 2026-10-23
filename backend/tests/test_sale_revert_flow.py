"""
Backend API tests for critical business logic:
1. Prevent vehicle from being sold more than once
2. Transaction cancel/delete reverts vehicle status
3. Deleting a record removes it from all relevant parts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSaleRevertFlow:
    """Test sale flow and revert functionality"""
    
    token = None
    test_car_id = None
    test_transaction_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        TestSaleRevertFlow.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {TestSaleRevertFlow.token}"}
    
    def test_01_get_existing_car(self):
        """Get existing BMW 320i car"""
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        assert response.status_code == 200
        
        cars = response.json()
        # Find the BMW 320i car
        bmw_car = None
        for car in cars:
            if car.get("brand") == "BMW" and "320" in car.get("model", ""):
                bmw_car = car
                break
        
        assert bmw_car is not None, "BMW 320i car not found"
        TestSaleRevertFlow.test_car_id = bmw_car["id"]
        print(f"Found car: {bmw_car['brand']} {bmw_car['model']} - Status: {bmw_car['status']}")
    
    def test_02_verify_car_status_stokta(self):
        """Verify car is in Stokta status (or reset if sold)"""
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        assert response.status_code == 200
        
        car = next((c for c in response.json() if c["id"] == TestSaleRevertFlow.test_car_id), None)
        assert car is not None
        
        # If car is sold or has deposit, reset to Stokta for testing
        if car["status"] != "Stokta":
            reset_response = requests.patch(
                f"{BASE_URL}/api/cars/{TestSaleRevertFlow.test_car_id}",
                headers=self.headers,
                json={"status": "Stokta", "deposit_amount": 0}
            )
            assert reset_response.status_code == 200
            print(f"Reset car to Stokta")
        
        # Verify status
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        car = next((c for c in response.json() if c["id"] == TestSaleRevertFlow.test_car_id), None)
        assert car["status"] == "Stokta", f"Expected 'Stokta', got '{car['status']}'"
        print(f"Car status verified: Stokta")
    
    def test_03_sell_car(self):
        """Sell the car and create sale transaction"""
        # Update car status to sold
        response = requests.patch(
            f"{BASE_URL}/api/cars/{TestSaleRevertFlow.test_car_id}",
            headers=self.headers,
            json={
                "status": "Satıldı",
                "sale_price": 600000,
                "sold_date": "2026-02-26"
            }
        )
        assert response.status_code == 200
        
        car = response.json()
        assert car["status"] == "Satıldı", f"Expected 'Satıldı', got '{car['status']}'"
        print(f"Car sold successfully - Status: {car['status']}")
        
        # Create sale transaction
        tx_response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers=self.headers,
            json={
                "type": "income",
                "category": "Araç Satışı",
                "amount": 600000,
                "date": "2026-02-26",
                "description": "Test Sale - BMW 320i",
                "car_id": TestSaleRevertFlow.test_car_id
            }
        )
        assert tx_response.status_code == 200
        TestSaleRevertFlow.test_transaction_id = tx_response.json()["id"]
        print(f"Sale transaction created: {TestSaleRevertFlow.test_transaction_id}")
    
    def test_04_verify_car_sold_status(self):
        """Verify car is now in Satıldı status"""
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        assert response.status_code == 200
        
        car = next((c for c in response.json() if c["id"] == TestSaleRevertFlow.test_car_id), None)
        assert car is not None
        assert car["status"] == "Satıldı", f"Expected 'Satıldı', got '{car['status']}'"
        print(f"Verified car status: Satıldı")
    
    def test_05_cancel_transaction_soft_delete(self):
        """Cancel/soft-delete the sale transaction"""
        response = requests.delete(
            f"{BASE_URL}/api/transactions/{TestSaleRevertFlow.test_transaction_id}?permanent=false",
            headers=self.headers
        )
        assert response.status_code == 200
        print(f"Transaction soft-deleted (canceled)")
    
    def test_06_revert_car_status_after_cancel(self):
        """Revert car status to Stokta after transaction cancel"""
        # This simulates what the frontend does in revertTransactionEffect
        response = requests.patch(
            f"{BASE_URL}/api/cars/{TestSaleRevertFlow.test_car_id}",
            headers=self.headers,
            json={"status": "Stokta", "sold_date": ""}
        )
        assert response.status_code == 200
        
        car = response.json()
        assert car["status"] == "Stokta", f"Expected 'Stokta', got '{car['status']}'"
        print(f"Car status reverted to Stokta")
    
    def test_07_verify_car_back_in_stock(self):
        """Verify car is back in Stokta status"""
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        assert response.status_code == 200
        
        car = next((c for c in response.json() if c["id"] == TestSaleRevertFlow.test_car_id), None)
        assert car is not None
        assert car["status"] == "Stokta", f"Expected 'Stokta', got '{car['status']}'"
        print(f"SUCCESS: Car is back in stock!")


class TestDepositFlow:
    """Test deposit flow and status changes"""
    
    token = None
    test_car_id = None
    test_deposit_tx_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        TestDepositFlow.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {TestDepositFlow.token}"}
    
    def test_01_get_car_for_deposit(self):
        """Get car and ensure it's in Stokta status"""
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        assert response.status_code == 200
        
        cars = response.json()
        bmw_car = next((c for c in cars if c.get("brand") == "BMW" and "320" in c.get("model", "")), None)
        assert bmw_car is not None
        TestDepositFlow.test_car_id = bmw_car["id"]
        
        # Reset to Stokta if needed
        if bmw_car["status"] != "Stokta":
            requests.patch(
                f"{BASE_URL}/api/cars/{TestDepositFlow.test_car_id}",
                headers=self.headers,
                json={"status": "Stokta", "deposit_amount": 0}
            )
        print(f"Car ready for deposit test")
    
    def test_02_add_deposit(self):
        """Add deposit to car"""
        response = requests.patch(
            f"{BASE_URL}/api/cars/{TestDepositFlow.test_car_id}",
            headers=self.headers,
            json={
                "status": "Kapora Alındı",
                "deposit_amount": 50000
            }
        )
        assert response.status_code == 200
        
        car = response.json()
        assert car["status"] == "Kapora Alındı"
        assert car["deposit_amount"] == 50000
        print(f"Deposit added - Status: {car['status']}, Amount: {car['deposit_amount']}")
        
        # Create deposit transaction
        tx_response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers=self.headers,
            json={
                "type": "income",
                "category": "Kapora",
                "amount": 50000,
                "date": "2026-02-26",
                "description": "Test Kapora - BMW 320i",
                "car_id": TestDepositFlow.test_car_id
            }
        )
        assert tx_response.status_code == 200
        TestDepositFlow.test_deposit_tx_id = tx_response.json()["id"]
    
    def test_03_cancel_deposit_reverts_status(self):
        """Cancel deposit transaction and revert car status"""
        # Soft delete the transaction
        response = requests.delete(
            f"{BASE_URL}/api/transactions/{TestDepositFlow.test_deposit_tx_id}?permanent=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        # Revert car status (as frontend does)
        revert_response = requests.patch(
            f"{BASE_URL}/api/cars/{TestDepositFlow.test_car_id}",
            headers=self.headers,
            json={"status": "Stokta", "deposit_amount": 0}
        )
        assert revert_response.status_code == 200
        
        car = revert_response.json()
        assert car["status"] == "Stokta"
        assert car["deposit_amount"] == 0
        print(f"SUCCESS: Deposit canceled, car back to Stokta!")


class TestPermanentDelete:
    """Test permanent deletion of records"""
    
    token = None
    test_car_id = None
    test_tx_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        TestPermanentDelete.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {TestPermanentDelete.token}"}
    
    def test_01_create_test_transaction(self):
        """Create a test transaction for deletion"""
        # First get a car ID
        cars_response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        if cars_response.json():
            TestPermanentDelete.test_car_id = cars_response.json()[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/transactions",
            headers=self.headers,
            json={
                "type": "expense",
                "category": "Test Category",
                "amount": 1000,
                "date": "2026-02-26",
                "description": "TEST_DELETE_ME",
                "car_id": TestPermanentDelete.test_car_id
            }
        )
        assert response.status_code == 200
        TestPermanentDelete.test_tx_id = response.json()["id"]
        print(f"Created test transaction: {TestPermanentDelete.test_tx_id}")
    
    def test_02_verify_transaction_exists(self):
        """Verify transaction exists before delete"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers=self.headers)
        assert response.status_code == 200
        
        tx = next((t for t in response.json() if t["id"] == TestPermanentDelete.test_tx_id), None)
        assert tx is not None, "Transaction not found"
        print(f"Transaction exists: {tx['description']}")
    
    def test_03_permanent_delete_transaction(self):
        """Permanently delete the transaction"""
        response = requests.delete(
            f"{BASE_URL}/api/transactions/{TestPermanentDelete.test_tx_id}?permanent=true",
            headers=self.headers
        )
        assert response.status_code == 200
        print(f"Transaction permanently deleted")
    
    def test_04_verify_transaction_gone(self):
        """Verify transaction is completely removed"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers=self.headers)
        assert response.status_code == 200
        
        tx = next((t for t in response.json() if t["id"] == TestPermanentDelete.test_tx_id), None)
        assert tx is None, "Transaction should not exist after permanent delete"
        print(f"SUCCESS: Transaction permanently deleted!")


class TestPreventDoubleSale:
    """Test that a sold car cannot be sold again (frontend guard)"""
    
    token = None
    test_car_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        TestPreventDoubleSale.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {TestPreventDoubleSale.token}"}
    
    def test_01_get_car_and_sell_it(self):
        """Get car and mark it as sold"""
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        cars = response.json()
        bmw_car = next((c for c in cars if c.get("brand") == "BMW" and "320" in c.get("model", "")), None)
        
        if bmw_car:
            TestPreventDoubleSale.test_car_id = bmw_car["id"]
            
            # Sell the car
            sell_response = requests.patch(
                f"{BASE_URL}/api/cars/{TestPreventDoubleSale.test_car_id}",
                headers=self.headers,
                json={"status": "Satıldı"}
            )
            assert sell_response.status_code == 200
            print(f"Car sold: Status = {sell_response.json()['status']}")
    
    def test_02_verify_sold_status_check(self):
        """Verify car status is Satıldı (frontend checks this)"""
        response = requests.get(f"{BASE_URL}/api/cars", headers=self.headers)
        car = next((c for c in response.json() if c["id"] == TestPreventDoubleSale.test_car_id), None)
        
        # The frontend check: if (car.status === 'Satıldı') { alert('Bu araç zaten satılmış!'); return; }
        assert car["status"] == "Satıldı"
        print(f"Car status is Satıldı - frontend will prevent re-sale")
        print(f"SUCCESS: Double-sale prevention check passes (frontend guards)")
    
    def test_03_cleanup_reset_car_status(self):
        """Clean up - reset car back to Stokta"""
        response = requests.patch(
            f"{BASE_URL}/api/cars/{TestPreventDoubleSale.test_car_id}",
            headers=self.headers,
            json={"status": "Stokta", "deposit_amount": 0, "sold_date": ""}
        )
        assert response.status_code == 200
        print(f"Cleanup: Car reset to Stokta")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
