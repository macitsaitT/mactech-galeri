"""
Test Appointments API - Calendar feature for test drive scheduling
Tests: CRUD operations for appointments (POST, GET, PUT, DELETE)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@aslanbasoto.com"
TEST_PASSWORD = "demo123"

class TestAppointmentsAPI:
    """Test Appointments CRUD API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_appointment_ids = []
    
    def teardown_method(self):
        """Cleanup: delete created appointments after each test"""
        for app_id in self.created_appointment_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/appointments/{app_id}",
                    headers=self.headers
                )
            except:
                pass
    
    def test_get_appointments_list(self):
        """GET /api/appointments returns list of appointments"""
        response = requests.get(f"{BASE_URL}/api/appointments", headers=self.headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET /api/appointments - Found {len(data)} appointments")
    
    def test_create_appointment(self):
        """POST /api/appointments creates new appointment"""
        appointment_data = {
            "title": "TEST_Test Sürüşü",
            "customer_name": "Test Müşteri",
            "customer_phone": "0532 123 4567",
            "car_id": "",
            "car_info": "BMW 320i - 34 ABC 123",
            "date": "2026-02-28",
            "time": "10:00",
            "notes": "Pytest test randevusu",
            "status": "Bekliyor"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/appointments",
            json=appointment_data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Data assertions
        assert "id" in data, "Response should contain 'id'"
        assert data["title"] == appointment_data["title"]
        assert data["customer_name"] == appointment_data["customer_name"]
        assert data["date"] == appointment_data["date"]
        assert data["time"] == appointment_data["time"]
        assert data["status"] == "Bekliyor"
        
        self.created_appointment_ids.append(data["id"])
        print(f"SUCCESS: POST /api/appointments - Created appointment {data['id']}")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/appointments", headers=self.headers)
        assert get_response.status_code == 200
        appointments = get_response.json()
        found = any(a["id"] == data["id"] for a in appointments)
        assert found, "Created appointment should be in the list"
        print("SUCCESS: Appointment persisted and verified via GET")
    
    def test_update_appointment_status(self):
        """PUT /api/appointments/{id} updates appointment status"""
        # First create an appointment
        appointment_data = {
            "title": "TEST_Status Update Test",
            "customer_name": "Update Test",
            "date": "2026-03-01",
            "time": "14:00",
            "status": "Bekliyor"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/appointments",
            json=appointment_data,
            headers=self.headers
        )
        assert create_response.status_code == 200
        app_id = create_response.json()["id"]
        self.created_appointment_ids.append(app_id)
        
        # Update status: Bekliyor → Onaylandı
        update_response = requests.put(
            f"{BASE_URL}/api/appointments/{app_id}",
            json={"status": "Onaylandı"},
            headers=self.headers
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        updated_data = update_response.json()
        assert updated_data["status"] == "Onaylandı", "Status should be updated to Onaylandı"
        print(f"SUCCESS: PUT /api/appointments/{app_id} - Status updated to Onaylandı")
        
        # Update status: Onaylandı → Tamamlandı
        complete_response = requests.put(
            f"{BASE_URL}/api/appointments/{app_id}",
            json={"status": "Tamamlandı"},
            headers=self.headers
        )
        
        assert complete_response.status_code == 200
        final_data = complete_response.json()
        assert final_data["status"] == "Tamamlandı", "Status should be updated to Tamamlandı"
        print("SUCCESS: Status updated to Tamamlandı")
    
    def test_delete_appointment(self):
        """DELETE /api/appointments/{id} removes appointment"""
        # First create an appointment
        appointment_data = {
            "title": "TEST_Delete Test",
            "date": "2026-03-05",
            "time": "11:00"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/appointments",
            json=appointment_data,
            headers=self.headers
        )
        assert create_response.status_code == 200
        app_id = create_response.json()["id"]
        
        # Delete the appointment
        delete_response = requests.delete(
            f"{BASE_URL}/api/appointments/{app_id}",
            headers=self.headers
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        data = delete_response.json()
        assert data.get("success") == True, "Delete should return success: true"
        print(f"SUCCESS: DELETE /api/appointments/{app_id}")
        
        # Verify appointment is removed via GET
        get_response = requests.get(f"{BASE_URL}/api/appointments", headers=self.headers)
        assert get_response.status_code == 200
        appointments = get_response.json()
        found = any(a["id"] == app_id for a in appointments)
        assert not found, "Deleted appointment should not be in the list"
        print("SUCCESS: Appointment verified as deleted")
    
    def test_appointment_with_all_fields(self):
        """Test creating appointment with all optional fields"""
        full_appointment = {
            "title": "TEST_Full Appointment Test",
            "customer_name": "Ahmet Yılmaz",
            "customer_phone": "0532 111 2222",
            "car_id": "",
            "car_info": "Mercedes C180 - 34 XYZ 789",
            "date": "2026-03-10",
            "time": "15:30",
            "notes": "VIP müşteri, özel ilgi gösterilmeli",
            "status": "Bekliyor"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/appointments",
            json=full_appointment,
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        self.created_appointment_ids.append(data["id"])
        
        # Verify all fields
        assert data["title"] == full_appointment["title"]
        assert data["customer_name"] == full_appointment["customer_name"]
        assert data["customer_phone"] == full_appointment["customer_phone"]
        assert data["car_info"] == full_appointment["car_info"]
        assert data["date"] == full_appointment["date"]
        assert data["time"] == full_appointment["time"]
        assert data["notes"] == full_appointment["notes"]
        assert data["status"] == full_appointment["status"]
        assert "created_at" in data, "Should have created_at timestamp"
        
        print("SUCCESS: Full appointment with all fields created and verified")
    
    def test_unauthorized_access(self):
        """Test that endpoints require authentication"""
        # Try without token
        response = requests.get(f"{BASE_URL}/api/appointments")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: Unauthorized access properly rejected")


class TestServiceWorker:
    """Test Service Worker availability"""
    
    def test_service_worker_accessible(self):
        """Service Worker file should be accessible at /sw.js"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "aslanbasoto" in response.text.lower() or "cache" in response.text.lower()
        print("SUCCESS: Service Worker accessible at /sw.js")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
