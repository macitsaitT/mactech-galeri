#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone

class AslanbasOtoCRMTester:
    def __init__(self, base_url="https://crm-modular-build.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_ids = {"cars": [], "customers": [], "transactions": []}

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, require_auth=True):
        """Run a single API test"""
        url = f"{self.api_base}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if require_auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return success, response.json() if response.text else {}
                except:
                    return success, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    self.log(f"   Error: {error_data}")
                except:
                    self.log(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Exception: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic connectivity"""
        self.log("\n=== HEALTH CHECK ===")
        success, response = self.run_test("Health Check", "GET", "", 200, require_auth=False)
        return success

    def test_auth_register(self):
        """Test user registration"""
        self.log("\n=== AUTHENTICATION ===")
        test_email = f"testuser_{int(datetime.now().timestamp())}@test.com"
        success, response = self.run_test(
            "Register User",
            "POST",
            "auth/register",
            200,
            {
                "email": test_email,
                "password": "testpass123",
                "company_name": "Test Company",
                "phone": "5321234567"
            },
            require_auth=False
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response.get('user', {}).get('id')
            self.log(f"✅ Registration successful, got token")
        
        return success

    def test_auth_login(self):
        """Test user login with demo credentials"""
        success, response = self.run_test(
            "Login Demo User",
            "POST",
            "auth/login",
            200,
            {
                "email": "demo@aslanbasoto.com",
                "password": "demo123"
            },
            require_auth=False
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response.get('user', {}).get('id')
            self.log(f"✅ Demo login successful")
        else:
            # Fallback to register new user
            self.log("⚠️ Demo login failed, creating new user...")
            return self.test_auth_register()
        
        return success

    def test_auth_me(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_car_crud(self):
        """Test car CRUD operations"""
        self.log("\n=== CAR MANAGEMENT ===")
        
        # Create car
        car_data = {
            "brand": "BMW",
            "model": "320i",
            "year": 2020,
            "plate": "34TEST123",
            "km": "50000",
            "vehicle_type": "Sedan",
            "purchase_price": 150000,
            "sale_price": 180000,
            "description": "Test car",
            "status": "Stokta",
            "entry_date": "2024-01-01",
            "inspection_date": "2024-12-01",
            "fuel_type": "Benzin",
            "gear": "Otomatik",
            "ownership": "stock",
            "owner_name": "",
            "owner_phone": "",
            "commission_rate": 0,
            "photos": [],
            "expertise": {},
            "package_info": "",
            "engine_type": "1.6 Turbo"
        }
        
        success, response = self.run_test(
            "Create Car",
            "POST",
            "cars",
            200,
            car_data
        )
        
        car_id = None
        if success and 'id' in response:
            car_id = response['id']
            self.created_ids["cars"].append(car_id)
            self.log(f"✅ Car created with ID: {car_id}")

        # Get all cars
        self.run_test("Get All Cars", "GET", "cars", 200)
        
        if car_id:
            # Update car
            update_data = {**car_data, "km": "60000", "description": "Updated test car"}
            self.run_test(
                "Update Car",
                "PUT",
                f"cars/{car_id}",
                200,
                update_data
            )
            
            # Patch car
            patch_data = {"status": "Kapora Alındı", "deposit_amount": 10000}
            self.run_test(
                "Patch Car",
                "PATCH",
                f"cars/{car_id}",
                200,
                patch_data
            )
            
            # Test consignment car
            consignment_data = {**car_data}
            consignment_data.update({
                "ownership": "consignment",
                "owner_name": "Test Owner",
                "owner_phone": "5321234567",
                "commission_rate": 5,
                "plate": "34CONS123"
            })
            
            success, response = self.run_test(
                "Create Consignment Car",
                "POST",
                "cars",
                200,
                consignment_data
            )
            
            if success and 'id' in response:
                self.created_ids["cars"].append(response['id'])

        return True

    def test_customer_crud(self):
        """Test customer CRUD operations"""
        self.log("\n=== CUSTOMER MANAGEMENT ===")
        
        # Create customer
        customer_data = {
            "name": "Test Müşteri",
            "phone": "5321234567",
            "type": "Potansiyel",
            "notes": "Test customer notes",
            "interested_car_id": ""
        }
        
        success, response = self.run_test(
            "Create Customer",
            "POST",
            "customers",
            200,
            customer_data
        )
        
        customer_id = None
        if success and 'id' in response:
            customer_id = response['id']
            self.created_ids["customers"].append(customer_id)

        # Get all customers
        self.run_test("Get All Customers", "GET", "customers", 200)
        
        if customer_id:
            # Update customer
            update_data = {**customer_data, "type": "Aktif Müşteri"}
            self.run_test(
                "Update Customer",
                "PUT",
                f"customers/{customer_id}",
                200,
                update_data
            )

        return True

    def test_transaction_crud(self):
        """Test transaction CRUD operations"""
        self.log("\n=== TRANSACTION MANAGEMENT ===")
        
        # Create income transaction
        income_data = {
            "type": "income",
            "category": "Araç Satışı",
            "description": "Test car sale",
            "amount": 180000,
            "date": "2024-01-15",
            "car_id": self.created_ids["cars"][0] if self.created_ids["cars"] else ""
        }
        
        success, response = self.run_test(
            "Create Income Transaction",
            "POST",
            "transactions",
            200,
            income_data
        )
        
        if success and 'id' in response:
            self.created_ids["transactions"].append(response['id'])

        # Create expense transaction
        expense_data = {
            "type": "expense",
            "category": "Araç Alımı",
            "description": "Test car purchase",
            "amount": 150000,
            "date": "2024-01-01",
            "car_id": self.created_ids["cars"][0] if self.created_ids["cars"] else ""
        }
        
        success, response = self.run_test(
            "Create Expense Transaction",
            "POST",
            "transactions",
            200,
            expense_data
        )
        
        if success and 'id' in response:
            self.created_ids["transactions"].append(response['id'])

        # Get all transactions
        self.run_test("Get All Transactions", "GET", "transactions", 200)

        return True

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        self.log("\n=== DASHBOARD STATS ===")
        
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "stats",
            200
        )
        
        if success:
            expected_keys = [
                'total_cars', 'stock_cars', 'consignment_cars', 'sold_cars',
                'total_income', 'total_expense', 'net_profit', 'stock_value', 'total_customers'
            ]
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                self.log(f"⚠️ Missing stats keys: {missing_keys}")
            else:
                self.log(f"✅ All required stats present")

        return success

    def cleanup_test_data(self):
        """Clean up test data"""
        self.log("\n=== CLEANUP ===")
        
        # Delete test cars
        for car_id in self.created_ids["cars"]:
            self.run_test(f"Delete Car {car_id}", "DELETE", f"cars/{car_id}?permanent=true", 200)
        
        # Delete test customers
        for customer_id in self.created_ids["customers"]:
            self.run_test(f"Delete Customer {customer_id}", "DELETE", f"customers/{customer_id}?permanent=true", 200)

    def run_full_test_suite(self):
        """Run complete test suite"""
        self.log("🚀 Starting Aslanbaş Oto CRM API Test Suite")
        self.log(f"🌐 Base URL: {self.base_url}")
        
        try:
            # Health check
            if not self.test_health_check():
                self.log("❌ Health check failed, aborting tests")
                return False

            # Authentication
            if not self.test_auth_login():
                self.log("❌ Authentication failed, aborting tests")
                return False
            
            self.test_auth_me()
            
            # Core CRUD operations
            self.test_car_crud()
            self.test_customer_crud() 
            self.test_transaction_crud()
            
            # Dashboard stats
            self.test_dashboard_stats()
            
            # Cleanup
            self.cleanup_test_data()
            
            # Final summary
            self.log(f"\n📊 TEST SUMMARY")
            self.log(f"Tests passed: {self.tests_passed}/{self.tests_run}")
            success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
            self.log(f"Success rate: {success_rate:.1f}%")
            
            if success_rate >= 90:
                self.log("🎉 Backend tests PASSED!")
                return True
            elif success_rate >= 70:
                self.log("⚠️ Backend tests passed with warnings")
                return True
            else:
                self.log("❌ Backend tests FAILED!")
                return False
                
        except Exception as e:
            self.log(f"💥 Test suite failed with exception: {e}")
            return False

def main():
    tester = AslanbasOtoCRMTester()
    success = tester.run_full_test_suite()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())