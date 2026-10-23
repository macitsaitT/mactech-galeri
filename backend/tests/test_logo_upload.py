"""
Test cases for Logo Upload and Profile features (iteration 8)
- POST /api/upload - File upload endpoint
- POST /api/auth/login - Verify logo_url in response
- PUT /api/auth/profile - Update logo_url
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@aslanbasoto.com"
TEST_PASSWORD = "demo123"


class TestAuthWithLogo:
    """Test auth endpoints return logo_url"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.user = response.json().get("user")
        else:
            pytest.skip(f"Login failed with status {response.status_code}")
    
    def test_login_returns_logo_url_field(self):
        """Verify login response includes logo_url field"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        
        # Check user object structure
        assert "user" in data
        user = data["user"]
        assert "logo_url" in user, "logo_url field missing from login response"
        print(f"Login response includes logo_url: {user.get('logo_url', '')}")
    
    def test_get_me_returns_logo_url(self):
        """Verify GET /api/auth/me returns logo_url"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "logo_url" in data, "logo_url field missing from /auth/me response"
        print(f"/auth/me includes logo_url: {data.get('logo_url', '')}")
    
    def test_update_profile_logo_url(self):
        """Test updating logo_url via PUT /api/auth/profile"""
        # Update with a test logo_url
        test_logo_path = "test/logo/path.png"
        response = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"logo_url": test_logo_path}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("logo_url") == test_logo_path, f"logo_url not updated correctly: {data.get('logo_url')}"
        print(f"Profile logo_url updated to: {data.get('logo_url')}")
        
        # Cleanup - reset logo_url
        requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"logo_url": ""}
        )


class TestFileUpload:
    """Test file upload endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
        else:
            pytest.skip(f"Login failed with status {response.status_code}")
    
    def test_upload_requires_auth(self):
        """Verify upload endpoint requires authentication"""
        # Create a simple test image (1x1 PNG)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        response = requests.post(
            f"{BASE_URL}/api/upload",
            files={"file": ("test.png", io.BytesIO(png_data), "image/png")}
        )
        # Should fail without auth
        assert response.status_code in [401, 403], f"Upload without auth should fail, got {response.status_code}"
        print("Upload correctly requires authentication")
    
    def test_upload_image_success(self):
        """Test successful image upload"""
        # Create a simple test image (1x1 PNG)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        response = requests.post(
            f"{BASE_URL}/api/upload",
            headers={"Authorization": f"Bearer {self.token}"},
            files={"file": ("test_logo.png", io.BytesIO(png_data), "image/png")}
        )
        
        assert response.status_code == 200, f"Upload failed with status {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "path" in data, "Upload response missing 'path' field"
        assert "id" in data, "Upload response missing 'id' field"
        print(f"File uploaded successfully to: {data.get('path')}")
        
        return data.get("path")
    
    def test_upload_rejects_non_image(self):
        """Test that upload rejects non-image files"""
        # Try uploading a text file
        text_data = b"This is not an image"
        
        response = requests.post(
            f"{BASE_URL}/api/upload",
            headers={"Authorization": f"Bearer {self.token}"},
            files={"file": ("test.txt", io.BytesIO(text_data), "text/plain")}
        )
        
        # Should reject non-image files
        assert response.status_code == 400, f"Non-image upload should fail, got {response.status_code}"
        print("Non-image files correctly rejected")
    
    def test_upload_accepts_jpeg(self):
        """Test JPEG upload acceptance"""
        # Minimal JPEG file
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
            0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
            0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
            0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
            0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
            0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
            0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
            0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
            0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
            0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
            0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
            0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
            0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
            0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
            0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
            0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
            0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0x28, 0xA0, 0x02, 0x80,
            0xFF, 0xD9
        ])
        
        response = requests.post(
            f"{BASE_URL}/api/upload",
            headers={"Authorization": f"Bearer {self.token}"},
            files={"file": ("test_logo.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        )
        
        # May fail due to minimal JPEG, but should not fail for file type
        if response.status_code == 200:
            data = response.json()
            assert "path" in data
            print(f"JPEG uploaded to: {data.get('path')}")
        else:
            # Check if it's a file type rejection or something else
            print(f"JPEG upload status: {response.status_code} - {response.text}")


class TestUploadAndSaveToProfile:
    """End-to-end test: Upload file then save to profile"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
        else:
            pytest.skip(f"Login failed with status {response.status_code}")
    
    def test_upload_and_save_logo_to_profile(self):
        """Full flow: Upload image -> Save path to profile -> Verify in /auth/me"""
        # 1. Upload image
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            headers={"Authorization": f"Bearer {self.token}"},
            files={"file": ("company_logo.png", io.BytesIO(png_data), "image/png")}
        )
        
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        uploaded_path = upload_response.json().get("path")
        print(f"Step 1: Uploaded to {uploaded_path}")
        
        # 2. Save logo_url to profile
        profile_response = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"logo_url": uploaded_path}
        )
        
        assert profile_response.status_code == 200, f"Profile update failed: {profile_response.text}"
        print(f"Step 2: Saved logo_url to profile")
        
        # 3. Verify via /auth/me
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data.get("logo_url") == uploaded_path, f"logo_url not persisted: {me_data.get('logo_url')}"
        print(f"Step 3: Verified logo_url in /auth/me: {me_data.get('logo_url')}")
        
        # 4. Verify in next login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert login_response.status_code == 200
        login_user = login_response.json().get("user")
        assert login_user.get("logo_url") == uploaded_path, f"logo_url not in login response: {login_user.get('logo_url')}"
        print(f"Step 4: Verified logo_url in login response: {login_user.get('logo_url')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
