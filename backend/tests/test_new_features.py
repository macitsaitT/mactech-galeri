"""
Test file for new features:
1. Documents field in CarBase model
2. Expertise/damage diagram data
3. Car CRUD with documents and expertise
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Use demo credentials with active subscription
TEST_EMAIL = "demo@mactech.com"
TEST_PASSWORD = "demo12345"


class TestNewFeatures:
    """Test new features: documents, expertise, calculations"""
    
    token = None
    user_id = None
    created_car_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client):
        """Setup: Login to get token"""
        if TestNewFeatures.token is None:
            # Login with demo user
            login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            assert login_response.status_code == 200, f"Login failed: {login_response.text}"
            data = login_response.json()
            TestNewFeatures.token = data.get("token")
            TestNewFeatures.user_id = data.get("user", {}).get("id")
        
        api_client.headers.update({"Authorization": f"Bearer {TestNewFeatures.token}"})
    
    def test_01_health_check(self, api_client):
        """Test API health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_02_create_car_with_documents(self, api_client):
        """Test creating a car with documents field"""
        car_data = {
            "brand": "BMW",
            "model": "320i",
            "year": 2023,
            "plate": f"34 TEST {uuid.uuid4().hex[:3].upper()}",
            "km": "15000",
            "vehicle_type": "Sedan",
            "purchase_price": 1500000,
            "sale_price": 1650000,
            "description": "Test car with documents",
            "status": "Stokta",
            "entry_date": "2024-01-15",
            "fuel_type": "Benzin",
            "gear": "Otomatik",
            "ownership": "stock",
            "photos": [],
            "expertise": {
                "parts": {
                    "kaput": "orijinal",
                    "tavan": "orijinal",
                    "bagaj": "boyali",
                    "on_tampon": "orijinal",
                    "arka_tampon": "degisen",
                    "sol_on_camurluk": "orijinal",
                    "sol_on_kapi": "lokal",
                    "sol_arka_kapi": "orijinal",
                    "sol_arka_camurluk": "orijinal",
                    "sag_on_camurluk": "orijinal",
                    "sag_on_kapi": "orijinal",
                    "sag_arka_kapi": "orijinal",
                    "sag_arka_camurluk": "orijinal"
                },
                "mechanical": {
                    "motor": "Orijinal",
                    "sanziman": "Orijinal",
                    "yuruyen": "Bakımlı"
                }
            },
            "expertise_score": 92,
            "tramer_amount": 25000,
            "expertise_notes": "Arka tampon değişmiş, sol ön kapı lokal boyalı",
            "documents": {
                "ruhsat": [{"path": "/uploads/test_ruhsat.pdf", "name": "ruhsat.pdf", "uploadedAt": "2024-01-15T10:00:00Z"}],
                "muayene": [],
                "sigorta": [{"path": "/uploads/test_sigorta.pdf", "name": "sigorta.pdf", "uploadedAt": "2024-01-15T10:00:00Z"}],
                "ekspertiz": [],
                "vekaletname": [],
                "diger": []
            }
        }
        
        response = api_client.post(f"{BASE_URL}/api/cars", json=car_data)
        assert response.status_code in [200, 201], f"Create car failed: {response.text}"
        
        created_car = response.json()
        TestNewFeatures.created_car_id = created_car.get("id")
        
        # Verify documents field is saved
        assert "documents" in created_car, "Documents field missing in response"
        assert created_car["documents"]["ruhsat"][0]["name"] == "ruhsat.pdf", "Ruhsat document not saved correctly"
        
        # Verify expertise field is saved
        assert "expertise" in created_car, "Expertise field missing in response"
        assert created_car["expertise"]["parts"]["bagaj"] == "boyali", "Expertise parts not saved correctly"
        assert created_car["expertise"]["mechanical"]["yuruyen"] == "Bakımlı", "Mechanical expertise not saved correctly"
        
        print(f"✓ Car created with documents and expertise, ID: {TestNewFeatures.created_car_id}")
    
    def test_03_get_car_with_documents(self, api_client):
        """Test retrieving car with documents field"""
        assert TestNewFeatures.created_car_id, "No car ID from previous test"
        
        response = api_client.get(f"{BASE_URL}/api/cars")
        assert response.status_code == 200, f"Get cars failed: {response.text}"
        
        cars = response.json()
        car = next((c for c in cars if c["id"] == TestNewFeatures.created_car_id), None)
        assert car is not None, "Created car not found in list"
        
        # Verify documents persisted
        assert "documents" in car, "Documents field missing after retrieval"
        assert len(car["documents"]["ruhsat"]) == 1, "Ruhsat document not persisted"
        assert len(car["documents"]["sigorta"]) == 1, "Sigorta document not persisted"
        
        # Verify expertise persisted
        assert car["expertise"]["parts"]["arka_tampon"] == "degisen", "Expertise parts not persisted"
        assert car["expertise_score"] == 92, "Expertise score not persisted"
        assert car["tramer_amount"] == 25000, "Tramer amount not persisted"
        
        print("✓ Car retrieved with documents and expertise data intact")
    
    def test_04_update_car_documents(self, api_client):
        """Test updating car documents"""
        assert TestNewFeatures.created_car_id, "No car ID from previous test"
        
        # Get current car to get plate
        response = api_client.get(f"{BASE_URL}/api/cars")
        cars = response.json()
        current_car = next((c for c in cars if c["id"] == TestNewFeatures.created_car_id), None)
        
        # Update with new documents
        update_data = {
            "brand": "BMW",
            "model": "320i",
            "year": 2023,
            "plate": current_car["plate"],
            "km": "16000",
            "vehicle_type": "Sedan",
            "purchase_price": 1500000,
            "sale_price": 1650000,
            "description": "Updated test car",
            "status": "Stokta",
            "entry_date": "2024-01-15",
            "fuel_type": "Benzin",
            "gear": "Otomatik",
            "ownership": "stock",
            "photos": [],
            "expertise": {
                "parts": {
                    "kaput": "boyali",  # Changed from orijinal
                    "tavan": "orijinal",
                    "bagaj": "boyali",
                    "on_tampon": "orijinal",
                    "arka_tampon": "degisen",
                    "sol_on_camurluk": "orijinal",
                    "sol_on_kapi": "lokal",
                    "sol_arka_kapi": "orijinal",
                    "sol_arka_camurluk": "orijinal",
                    "sag_on_camurluk": "orijinal",
                    "sag_on_kapi": "orijinal",
                    "sag_arka_kapi": "orijinal",
                    "sag_arka_camurluk": "orijinal"
                },
                "mechanical": {
                    "motor": "Orijinal",
                    "sanziman": "Orijinal",
                    "yuruyen": "Bakımlı"
                }
            },
            "expertise_score": 88,  # Updated score
            "tramer_amount": 35000,  # Updated tramer
            "expertise_notes": "Kaput da boyalı eklendi",
            "documents": {
                "ruhsat": [{"path": "/uploads/test_ruhsat.pdf", "name": "ruhsat.pdf", "uploadedAt": "2024-01-15T10:00:00Z"}],
                "muayene": [{"path": "/uploads/test_muayene.pdf", "name": "muayene.pdf", "uploadedAt": "2024-01-16T10:00:00Z"}],  # Added
                "sigorta": [{"path": "/uploads/test_sigorta.pdf", "name": "sigorta.pdf", "uploadedAt": "2024-01-15T10:00:00Z"}],
                "ekspertiz": [{"path": "/uploads/test_ekspertiz.pdf", "name": "ekspertiz.pdf", "uploadedAt": "2024-01-16T10:00:00Z"}],  # Added
                "vekaletname": [],
                "diger": []
            }
        }
        
        response = api_client.put(f"{BASE_URL}/api/cars/{TestNewFeatures.created_car_id}", json=update_data)
        assert response.status_code == 200, f"Update car failed: {response.text}"
        
        updated_car = response.json()
        
        # Verify documents updated
        assert len(updated_car["documents"]["muayene"]) == 1, "Muayene document not added"
        assert len(updated_car["documents"]["ekspertiz"]) == 1, "Ekspertiz document not added"
        
        # Verify expertise updated
        assert updated_car["expertise"]["parts"]["kaput"] == "boyali", "Kaput status not updated"
        assert updated_car["expertise_score"] == 88, "Expertise score not updated"
        assert updated_car["tramer_amount"] == 35000, "Tramer amount not updated"
        
        print("✓ Car documents and expertise updated successfully")
    
    def test_05_patch_car_expertise(self, api_client):
        """Test patching car expertise via PATCH endpoint"""
        assert TestNewFeatures.created_car_id, "No car ID from previous test"
        
        # Patch only expertise
        patch_data = {
            "expertise": {
                "parts": {
                    "kaput": "degisen",  # Changed to degisen
                    "tavan": "orijinal",
                    "bagaj": "boyali",
                    "on_tampon": "orijinal",
                    "arka_tampon": "degisen",
                    "sol_on_camurluk": "orijinal",
                    "sol_on_kapi": "lokal",
                    "sol_arka_kapi": "orijinal",
                    "sol_arka_camurluk": "orijinal",
                    "sag_on_camurluk": "orijinal",
                    "sag_on_kapi": "orijinal",
                    "sag_arka_kapi": "orijinal",
                    "sag_arka_camurluk": "orijinal"
                },
                "mechanical": {
                    "motor": "Değişmiş",  # Changed
                    "sanziman": "Orijinal",
                    "yuruyen": "Bakımlı"
                }
            },
            "expertise_score": 75
        }
        
        response = api_client.patch(f"{BASE_URL}/api/cars/{TestNewFeatures.created_car_id}", json=patch_data)
        assert response.status_code == 200, f"Patch car failed: {response.text}"
        
        patched_car = response.json()
        
        # Verify expertise patched
        assert patched_car["expertise"]["parts"]["kaput"] == "degisen", "Kaput not patched to degisen"
        assert patched_car["expertise"]["mechanical"]["motor"] == "Değişmiş", "Motor status not patched"
        assert patched_car["expertise_score"] == 75, "Expertise score not patched"
        
        print("✓ Car expertise patched successfully")
    
    def test_06_documents_structure_validation(self, api_client):
        """Test that documents structure has all 6 categories"""
        assert TestNewFeatures.created_car_id, "No car ID from previous test"
        
        response = api_client.get(f"{BASE_URL}/api/cars")
        assert response.status_code == 200
        
        cars = response.json()
        car = next((c for c in cars if c["id"] == TestNewFeatures.created_car_id), None)
        assert car is not None
        
        # Verify all 6 document categories exist
        required_categories = ["ruhsat", "muayene", "sigorta", "ekspertiz", "vekaletname", "diger"]
        for category in required_categories:
            assert category in car["documents"], f"Document category '{category}' missing"
        
        print("✓ All 6 document categories present in car data")
    
    def test_07_expertise_parts_validation(self, api_client):
        """Test that expertise has all 13 body parts"""
        assert TestNewFeatures.created_car_id, "No car ID from previous test"
        
        response = api_client.get(f"{BASE_URL}/api/cars")
        assert response.status_code == 200
        
        cars = response.json()
        car = next((c for c in cars if c["id"] == TestNewFeatures.created_car_id), None)
        assert car is not None
        
        # Verify all 13 body parts exist
        required_parts = [
            "kaput", "tavan", "bagaj", "on_tampon", "arka_tampon",
            "sol_on_camurluk", "sol_on_kapi", "sol_arka_kapi", "sol_arka_camurluk",
            "sag_on_camurluk", "sag_on_kapi", "sag_arka_kapi", "sag_arka_camurluk"
        ]
        for part in required_parts:
            assert part in car["expertise"]["parts"], f"Expertise part '{part}' missing"
        
        # Verify mechanical parts
        mechanical_parts = ["motor", "sanziman", "yuruyen"]
        for part in mechanical_parts:
            assert part in car["expertise"]["mechanical"], f"Mechanical part '{part}' missing"
        
        print("✓ All 13 body parts and 3 mechanical parts present in expertise")
    
    def test_08_delete_car(self, api_client):
        """Test deleting the test car"""
        assert TestNewFeatures.created_car_id, "No car ID from previous test"
        
        response = api_client.delete(f"{BASE_URL}/api/cars/{TestNewFeatures.created_car_id}?permanent=true")
        assert response.status_code == 200, f"Delete car failed: {response.text}"
        
        print("✓ Test car deleted successfully")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
