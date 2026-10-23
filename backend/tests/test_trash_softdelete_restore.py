"""
Test cases for trash/recycle bin (Çöp Kutusu) feature:
- Soft-delete and restore for transactions
- Soft-delete and restore for appointments
- All entity types: cars, customers, transactions, appointments
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test-soldby@emergent.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="module")
def auth_token():
    """Login and get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.text}")
    return response.json().get("token")


@pytest.fixture
def api_client(auth_token):
    """Requests session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestTransactionSoftDelete:
    """Test soft-delete and restore for transactions"""

    def test_create_transaction(self, api_client):
        """Create a test transaction"""
        payload = {
            "type": "expense",
            "category": "TEST_Trash_Category",
            "description": "TEST_Trash transaction for soft-delete testing",
            "amount": 123.45,
            "date": datetime.now().strftime("%Y-%m-%d")
        }
        response = api_client.post(f"{BASE_URL}/api/transactions", json=payload)
        assert response.status_code == 200, f"Failed to create transaction: {response.text}"
        
        data = response.json()
        assert data.get("id") is not None
        assert data.get("deleted") == False
        pytest.test_transaction_id = data["id"]
        print(f"✓ Created transaction: {data['id']}")
        return data

    def test_soft_delete_transaction(self, api_client):
        """Soft-delete the transaction (permanent=false)"""
        if not hasattr(pytest, 'test_transaction_id'):
            pytest.skip("No transaction created")
        
        tx_id = pytest.test_transaction_id
        response = api_client.delete(f"{BASE_URL}/api/transactions/{tx_id}?permanent=false")
        assert response.status_code == 200, f"Soft-delete failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Soft-deleted transaction: {tx_id}")

    def test_transaction_is_marked_deleted(self, api_client):
        """Verify transaction has deleted=true after soft-delete"""
        if not hasattr(pytest, 'test_transaction_id'):
            pytest.skip("No transaction created")
        
        response = api_client.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200
        
        transactions = response.json()
        tx = next((t for t in transactions if t.get("id") == pytest.test_transaction_id), None)
        
        assert tx is not None, "Transaction not found in list"
        assert tx.get("deleted") == True, "Transaction should be marked as deleted"
        assert tx.get("deleted_at") is not None, "Transaction should have deleted_at timestamp"
        print(f"✓ Transaction marked as deleted with deleted_at: {tx.get('deleted_at')}")

    def test_restore_transaction(self, api_client):
        """Restore the soft-deleted transaction"""
        if not hasattr(pytest, 'test_transaction_id'):
            pytest.skip("No transaction created")
        
        tx_id = pytest.test_transaction_id
        response = api_client.post(f"{BASE_URL}/api/transactions/{tx_id}/restore")
        assert response.status_code == 200, f"Restore failed: {response.text}"
        
        data = response.json()
        assert data.get("deleted") == False, "Restored transaction should have deleted=false"
        assert data.get("deleted_at") is None, "Restored transaction should have deleted_at=null"
        print(f"✓ Restored transaction: {tx_id}")

    def test_transaction_restored_in_list(self, api_client):
        """Verify transaction is no longer marked as deleted"""
        if not hasattr(pytest, 'test_transaction_id'):
            pytest.skip("No transaction created")
        
        response = api_client.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200
        
        transactions = response.json()
        tx = next((t for t in transactions if t.get("id") == pytest.test_transaction_id), None)
        
        assert tx is not None, "Transaction not found in list"
        assert tx.get("deleted") == False, "Transaction should no longer be deleted"
        print(f"✓ Transaction restored and visible in list")

    def test_permanent_delete_transaction(self, api_client):
        """Permanently delete the transaction (cleanup)"""
        if not hasattr(pytest, 'test_transaction_id'):
            pytest.skip("No transaction created")
        
        tx_id = pytest.test_transaction_id
        response = api_client.delete(f"{BASE_URL}/api/transactions/{tx_id}?permanent=true")
        assert response.status_code == 200, f"Permanent delete failed: {response.text}"
        print(f"✓ Permanently deleted transaction: {tx_id}")

    def test_transaction_permanently_deleted(self, api_client):
        """Verify transaction is completely removed"""
        if not hasattr(pytest, 'test_transaction_id'):
            pytest.skip("No transaction created")
        
        response = api_client.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200
        
        transactions = response.json()
        tx = next((t for t in transactions if t.get("id") == pytest.test_transaction_id), None)
        
        assert tx is None, "Transaction should be permanently deleted and not found"
        print(f"✓ Transaction permanently deleted and not found in list")


class TestAppointmentSoftDelete:
    """Test soft-delete and restore for appointments"""

    def test_create_appointment(self, api_client):
        """Create a test appointment"""
        payload = {
            "title": "TEST_Trash Appointment",
            "customer_name": "TEST_Customer for Trash",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": "14:00",
            "notes": "Test appointment for soft-delete testing"
        }
        response = api_client.post(f"{BASE_URL}/api/appointments", json=payload)
        assert response.status_code == 200, f"Failed to create appointment: {response.text}"
        
        data = response.json()
        assert data.get("id") is not None
        assert data.get("deleted") == False
        pytest.test_appointment_id = data["id"]
        print(f"✓ Created appointment: {data['id']}")
        return data

    def test_soft_delete_appointment(self, api_client):
        """Soft-delete the appointment (permanent=false)"""
        if not hasattr(pytest, 'test_appointment_id'):
            pytest.skip("No appointment created")
        
        appt_id = pytest.test_appointment_id
        response = api_client.delete(f"{BASE_URL}/api/appointments/{appt_id}?permanent=false")
        assert response.status_code == 200, f"Soft-delete failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Soft-deleted appointment: {appt_id}")

    def test_appointment_is_marked_deleted(self, api_client):
        """Verify appointment has deleted=true after soft-delete"""
        if not hasattr(pytest, 'test_appointment_id'):
            pytest.skip("No appointment created")
        
        response = api_client.get(f"{BASE_URL}/api/appointments")
        assert response.status_code == 200
        
        appointments = response.json()
        appt = next((a for a in appointments if a.get("id") == pytest.test_appointment_id), None)
        
        assert appt is not None, "Appointment not found in list"
        assert appt.get("deleted") == True, "Appointment should be marked as deleted"
        assert appt.get("deleted_at") is not None, "Appointment should have deleted_at timestamp"
        print(f"✓ Appointment marked as deleted with deleted_at: {appt.get('deleted_at')}")

    def test_restore_appointment(self, api_client):
        """Restore the soft-deleted appointment"""
        if not hasattr(pytest, 'test_appointment_id'):
            pytest.skip("No appointment created")
        
        appt_id = pytest.test_appointment_id
        response = api_client.post(f"{BASE_URL}/api/appointments/{appt_id}/restore")
        assert response.status_code == 200, f"Restore failed: {response.text}"
        
        data = response.json()
        assert data.get("deleted") == False, "Restored appointment should have deleted=false"
        assert data.get("deleted_at") is None, "Restored appointment should have deleted_at=null"
        print(f"✓ Restored appointment: {appt_id}")

    def test_appointment_restored_in_list(self, api_client):
        """Verify appointment is no longer marked as deleted"""
        if not hasattr(pytest, 'test_appointment_id'):
            pytest.skip("No appointment created")
        
        response = api_client.get(f"{BASE_URL}/api/appointments")
        assert response.status_code == 200
        
        appointments = response.json()
        appt = next((a for a in appointments if a.get("id") == pytest.test_appointment_id), None)
        
        assert appt is not None, "Appointment not found in list"
        assert appt.get("deleted") == False, "Appointment should no longer be deleted"
        print(f"✓ Appointment restored and visible in list")

    def test_permanent_delete_appointment(self, api_client):
        """Permanently delete the appointment (cleanup)"""
        if not hasattr(pytest, 'test_appointment_id'):
            pytest.skip("No appointment created")
        
        appt_id = pytest.test_appointment_id
        response = api_client.delete(f"{BASE_URL}/api/appointments/{appt_id}?permanent=true")
        assert response.status_code == 200, f"Permanent delete failed: {response.text}"
        print(f"✓ Permanently deleted appointment: {appt_id}")

    def test_appointment_permanently_deleted(self, api_client):
        """Verify appointment is completely removed"""
        if not hasattr(pytest, 'test_appointment_id'):
            pytest.skip("No appointment created")
        
        response = api_client.get(f"{BASE_URL}/api/appointments")
        assert response.status_code == 200
        
        appointments = response.json()
        appt = next((a for a in appointments if a.get("id") == pytest.test_appointment_id), None)
        
        assert appt is None, "Appointment should be permanently deleted and not found"
        print(f"✓ Appointment permanently deleted and not found in list")


class TestCarSoftDeleteExisting:
    """Verify existing car soft-delete still works"""

    def test_car_soft_delete_restore(self, api_client):
        """Quick verify car soft-delete and restore"""
        # Create test car
        payload = {
            "brand": "TEST_TrashBrand",
            "model": "TEST_Model",
            "year": 2024,
            "plate": "TEST999"
        }
        response = api_client.post(f"{BASE_URL}/api/cars", json=payload)
        assert response.status_code == 200, f"Create car failed: {response.text}"
        car_id = response.json()["id"]
        print(f"✓ Created car: {car_id}")

        # Soft delete
        response = api_client.delete(f"{BASE_URL}/api/cars/{car_id}?permanent=false")
        assert response.status_code == 200
        print(f"✓ Soft-deleted car")

        # Restore
        response = api_client.post(f"{BASE_URL}/api/cars/{car_id}/restore")
        assert response.status_code == 200
        assert response.json().get("deleted") == False
        print(f"✓ Restored car")

        # Cleanup
        response = api_client.delete(f"{BASE_URL}/api/cars/{car_id}?permanent=true")
        assert response.status_code == 200
        print(f"✓ Permanently deleted car")


class TestCustomerSoftDeleteExisting:
    """Verify existing customer soft-delete still works"""

    def test_customer_soft_delete_restore(self, api_client):
        """Quick verify customer soft-delete and restore"""
        # Create test customer
        payload = {
            "name": "TEST_TrashCustomer",
            "phone": "555-9999",
            "type": "Potansiyel"
        }
        response = api_client.post(f"{BASE_URL}/api/customers", json=payload)
        assert response.status_code == 200, f"Create customer failed: {response.text}"
        customer_id = response.json()["id"]
        print(f"✓ Created customer: {customer_id}")

        # Soft delete
        response = api_client.delete(f"{BASE_URL}/api/customers/{customer_id}?permanent=false")
        assert response.status_code == 200
        print(f"✓ Soft-deleted customer")

        # Restore
        response = api_client.post(f"{BASE_URL}/api/customers/{customer_id}/restore")
        assert response.status_code == 200
        assert response.json().get("deleted") == False
        print(f"✓ Restored customer")

        # Cleanup
        response = api_client.delete(f"{BASE_URL}/api/customers/{customer_id}?permanent=true")
        assert response.status_code == 200
        print(f"✓ Permanently deleted customer")


class TestRestoreNotFound:
    """Test error handling for restore on non-existent items"""

    def test_restore_nonexistent_transaction(self, api_client):
        """Restore on non-existent transaction should return 404"""
        fake_id = str(uuid.uuid4())
        response = api_client.post(f"{BASE_URL}/api/transactions/{fake_id}/restore")
        assert response.status_code == 404
        print(f"✓ Correct 404 for non-existent transaction restore")

    def test_restore_nonexistent_appointment(self, api_client):
        """Restore on non-existent appointment should return 404"""
        fake_id = str(uuid.uuid4())
        response = api_client.post(f"{BASE_URL}/api/appointments/{fake_id}/restore")
        assert response.status_code == 404
        print(f"✓ Correct 404 for non-existent appointment restore")
