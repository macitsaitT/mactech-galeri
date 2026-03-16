"""
Tests for Photo Upload Feature - Bug Fix Verification
Tests: POST /api/upload, GET /api/files/{path}, Car photos CRUD
"""
import pytest
import requests
import os
import struct
import zlib
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

def create_test_png():
    """Create a minimal valid PNG (2x2 red pixels)"""
    width = 2
    height = 2
    bit_depth = 8
    color_type = 2  # RGB
    
    # PNG signature
    sig = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, bit_depth, color_type, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
    ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # IDAT chunk
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter byte
        for x in range(width):
            raw_data += b'\xff\x00\x00'  # Red RGB pixel
    
    compressed = zlib.compress(raw_data)
    idat_crc = zlib.crc32(b'IDAT' + compressed) & 0xffffffff
    idat = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND') & 0xffffffff
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    return sig + ihdr + idat + iend


class TestPhotoUpload:
    """Photo upload feature tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and auth token"""
        self.test_id = uuid.uuid4().hex[:8]
        self.email = f"test_photo_{self.test_id}@test.com"
        self.password = "password123"
        self.phone = "0532 123 45 67"
        self.token = None
        self.uploaded_paths = []
        self.car_ids = []
        
        # Register user
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.email,
            "password": self.password,
            "name": "Photo Test User",
            "phone": self.phone,
            "org_name": f"Test Org {self.test_id}"
        })
        
        if reg_resp.status_code == 200:
            # Verify email
            verify_code = reg_resp.json().get("verification_code")
            if verify_code:
                requests.post(f"{BASE_URL}/api/auth/verify-email", json={
                    "email": self.email,
                    "code": verify_code
                })
        
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.email,
            "password": self.password
        })
        
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("token")
        
        yield
        
        # Cleanup - delete test cars
        if self.token:
            headers = {"Authorization": f"Bearer {self.token}"}
            for car_id in self.car_ids:
                requests.delete(f"{BASE_URL}/api/cars/{car_id}?permanent=true", headers=headers)
    
    def test_upload_without_auth_returns_unauthorized(self):
        """POST /api/upload without auth token should return 401 or 403"""
        png_data = create_test_png()
        files = {'file': ('test.png', png_data, 'image/png')}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Upload without auth returns {response.status_code}")
    
    def test_upload_png_success(self):
        """POST /api/upload with valid PNG returns 200 with path"""
        if not self.token:
            pytest.skip("Authentication failed - skipping test")
        
        png_data = create_test_png()
        files = {'file': ('test.png', png_data, 'image/png')}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "path" in data, "Response should contain 'path'"
        assert "id" in data, "Response should contain 'id'"
        assert data["path"].endswith(".png"), f"Path should end with .png, got {data['path']}"
        
        self.uploaded_paths.append(data["path"])
        print(f"✓ Upload PNG returns 200 with path: {data['path']}")
        
        return data["path"]
    
    def test_download_file_with_auth_token(self):
        """GET /api/files/{path}?auth=TOKEN returns image data"""
        if not self.token:
            pytest.skip("Authentication failed - skipping test")
        
        # First upload a file
        png_data = create_test_png()
        files = {'file': ('test.png', png_data, 'image/png')}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        upload_resp = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        if upload_resp.status_code != 200:
            pytest.skip("Upload failed - skipping download test")
        
        file_path = upload_resp.json()["path"]
        
        # Download with auth query param
        download_resp = requests.get(f"{BASE_URL}/api/files/{file_path}?auth={self.token}")
        
        assert download_resp.status_code == 200, f"Expected 200, got {download_resp.status_code}"
        assert download_resp.headers.get("Content-Type", "").startswith("image/"), \
            f"Expected image content type, got {download_resp.headers.get('Content-Type')}"
        assert len(download_resp.content) > 0, "Downloaded content should not be empty"
        
        print(f"✓ Download file with auth token works, received {len(download_resp.content)} bytes")
    
    def test_download_file_without_auth_returns_401(self):
        """GET /api/files/{path} without auth returns 401"""
        # Use a fake path
        response = requests.get(f"{BASE_URL}/api/files/some/fake/path.png")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Download without auth returns 401")
    
    def test_upload_non_image_rejected(self):
        """POST /api/upload with non-image file returns 400"""
        if not self.token:
            pytest.skip("Authentication failed - skipping test")
        
        files = {'file': ('test.txt', b'This is not an image', 'text/plain')}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Non-image upload rejected with 400")
    
    def test_upload_invalid_magic_bytes_rejected(self):
        """POST /api/upload with fake PNG extension but wrong magic bytes returns 400"""
        if not self.token:
            pytest.skip("Authentication failed - skipping test")
        
        # Fake PNG - wrong magic bytes
        fake_png = b'Not a real PNG file content'
        files = {'file': ('fake.png', fake_png, 'image/png')}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid magic bytes rejected with 400")
    
    def test_create_car_with_photos(self):
        """POST /api/cars with photos array saves photos correctly"""
        if not self.token:
            pytest.skip("Authentication failed - skipping test")
        
        # First upload a photo
        png_data = create_test_png()
        files = {'file': ('test.png', png_data, 'image/png')}
        headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        auth_headers = {"Authorization": f"Bearer {self.token}"}
        
        upload_resp = requests.post(f"{BASE_URL}/api/upload", files=files, headers=auth_headers)
        if upload_resp.status_code != 200:
            pytest.skip("Upload failed - skipping car creation test")
        
        photo_path = upload_resp.json()["path"]
        
        # Create car with photos
        car_data = {
            "brand": "BMW",
            "model": "3 Serisi",
            "year": 2023,
            "plate": f"34 TEST {self.test_id[:4].upper()}",
            "km": "50000",
            "vehicle_type": "Sedan",
            "purchase_price": 500000,
            "sale_price": 550000,
            "status": "Stokta",
            "fuel_type": "Dizel",
            "gear": "Otomatik",
            "ownership": "stock",
            "photos": [photo_path]
        }
        
        response = requests.post(f"{BASE_URL}/api/cars", json=car_data, headers=headers)
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain car id"
        self.car_ids.append(data["id"])
        
        assert "photos" in data, "Response should contain photos"
        assert isinstance(data["photos"], list), "Photos should be a list"
        assert photo_path in data["photos"], f"Uploaded photo path should be in car photos"
        
        print(f"✓ Car created with photos array: {data['photos']}")
        
        return data["id"]
    
    def test_get_car_with_photos_intact(self):
        """GET /api/cars returns cars with photos array intact"""
        if not self.token:
            pytest.skip("Authentication failed - skipping test")
        
        # First create a car with photo
        png_data = create_test_png()
        files = {'file': ('test.png', png_data, 'image/png')}
        auth_headers = {"Authorization": f"Bearer {self.token}"}
        headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        
        upload_resp = requests.post(f"{BASE_URL}/api/upload", files=files, headers=auth_headers)
        if upload_resp.status_code != 200:
            pytest.skip("Upload failed")
        
        photo_path = upload_resp.json()["path"]
        
        car_data = {
            "brand": "Mercedes",
            "model": "E Serisi",
            "year": 2022,
            "plate": f"35 TEST {self.test_id[:4].upper()}",
            "km": "30000",
            "purchase_price": 700000,
            "sale_price": 750000,
            "status": "Stokta",
            "photos": [photo_path]
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/cars", json=car_data, headers=headers)
        if create_resp.status_code not in [200, 201]:
            pytest.skip("Car creation failed")
        
        car_id = create_resp.json()["id"]
        self.car_ids.append(car_id)
        
        # Now GET all cars and verify photos intact
        get_resp = requests.get(f"{BASE_URL}/api/cars", headers=headers)
        
        assert get_resp.status_code == 200, f"Expected 200, got {get_resp.status_code}"
        
        cars = get_resp.json()
        found_car = None
        for car in cars:
            if car.get("id") == car_id:
                found_car = car
                break
        
        assert found_car is not None, "Created car should be in the list"
        assert "photos" in found_car, "Car should have photos field"
        assert isinstance(found_car["photos"], list), "Photos should be a list"
        assert photo_path in found_car["photos"], "Photo path should be preserved"
        
        print(f"✓ GET cars returns photos intact: {found_car['photos']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
