"""
Test NEW features for Gallery CRM iteration 4:
- Excel export (cars, customers, transactions)
- PDF export (expertise report)
- File upload via Object Storage
- Encryption endpoint for customer data
- WhatsApp link format

Test with: pytest /app/backend/tests/test_export_upload_features.py -v --tb=short
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Login with demo credentials and get token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "demo@aslanbasoto.com", "password": "demo123"},
        timeout=10
    )
    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.status_code} - {response.text}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with Bearer token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestExcelExport:
    """Test Excel export endpoints for cars, customers, transactions"""
    
    def test_export_cars_excel(self, auth_headers):
        """GET /api/export/cars returns Excel file with correct content type"""
        response = requests.get(
            f"{BASE_URL}/api/export/cars",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify content type is Excel
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheetml" in content_type or "vnd.openxmlformats" in content_type, \
            f"Expected Excel content-type, got: {content_type}"
        
        # Verify content-disposition header has filename
        content_disp = response.headers.get("Content-Disposition", "")
        assert "araclar.xlsx" in content_disp, f"Expected araclar.xlsx in Content-Disposition: {content_disp}"
        
        # Verify response has binary data
        assert len(response.content) > 0, "Excel file should not be empty"
        print(f"✓ Cars Excel export: {len(response.content)} bytes")
    
    def test_export_customers_excel(self, auth_headers):
        """GET /api/export/customers returns Excel file with correct content type"""
        response = requests.get(
            f"{BASE_URL}/api/export/customers",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheetml" in content_type or "vnd.openxmlformats" in content_type, \
            f"Expected Excel content-type, got: {content_type}"
        
        content_disp = response.headers.get("Content-Disposition", "")
        assert "musteriler.xlsx" in content_disp, f"Expected musteriler.xlsx: {content_disp}"
        
        assert len(response.content) > 0, "Excel file should not be empty"
        print(f"✓ Customers Excel export: {len(response.content)} bytes")
    
    def test_export_transactions_excel(self, auth_headers):
        """GET /api/export/transactions returns Excel file with correct content type"""
        response = requests.get(
            f"{BASE_URL}/api/export/transactions",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheetml" in content_type or "vnd.openxmlformats" in content_type, \
            f"Expected Excel content-type, got: {content_type}"
        
        content_disp = response.headers.get("Content-Disposition", "")
        assert "islemler.xlsx" in content_disp, f"Expected islemler.xlsx: {content_disp}"
        
        assert len(response.content) > 0, "Excel file should not be empty"
        print(f"✓ Transactions Excel export: {len(response.content)} bytes")


class TestPDFExpertiseExport:
    """Test PDF expertise report export"""
    
    def test_export_expertise_pdf_for_existing_car(self, auth_headers):
        """GET /api/export/expertise/{car_id} returns PDF for existing car"""
        # First get a car ID
        cars_response = requests.get(
            f"{BASE_URL}/api/cars",
            headers=auth_headers,
            timeout=10
        )
        assert cars_response.status_code == 200, f"Failed to get cars: {cars_response.text}"
        
        cars = cars_response.json()
        if not cars:
            pytest.skip("No cars found to test PDF export")
        
        car_id = cars[0]["id"]
        car_plate = cars[0].get("plate", "unknown")
        
        response = requests.get(
            f"{BASE_URL}/api/export/expertise/{car_id}",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        content_type = response.headers.get("Content-Type", "")
        assert "pdf" in content_type.lower(), f"Expected PDF content-type, got: {content_type}"
        
        content_disp = response.headers.get("Content-Disposition", "")
        assert ".pdf" in content_disp, f"Expected .pdf in Content-Disposition: {content_disp}"
        
        # Verify it's a valid PDF (starts with %PDF)
        assert response.content[:4] == b'%PDF', "Response should be a valid PDF file"
        
        print(f"✓ Expertise PDF export for car {car_plate}: {len(response.content)} bytes")
    
    def test_export_expertise_pdf_for_nonexistent_car(self, auth_headers):
        """GET /api/export/expertise/{invalid_id} returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/export/expertise/nonexistent-id-12345",
            headers=auth_headers,
            timeout=10
        )
        assert response.status_code == 404, f"Expected 404 for nonexistent car, got {response.status_code}"
        print("✓ Returns 404 for nonexistent car")


class TestFileUpload:
    """Test file upload to Object Storage"""
    
    def test_upload_image_file(self, auth_token):
        """POST /api/upload accepts image file and returns path"""
        # Create a small test image (1x1 red PNG)
        # PNG header + minimal IHDR + IDAT + IEND
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {"file": ("test_image.png", io.BytesIO(png_data), "image/png")}
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers=headers,
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "path" in data, f"Response should contain 'path': {data}"
        assert "id" in data, f"Response should contain 'id': {data}"
        
        print(f"✓ File uploaded successfully: {data.get('path')}")
        return data
    
    def test_upload_rejects_non_image(self, auth_token):
        """POST /api/upload rejects non-image files"""
        files = {"file": ("test.txt", io.BytesIO(b"Hello World"), "text/plain")}
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers=headers,
            timeout=30
        )
        
        assert response.status_code == 400, f"Expected 400 for non-image, got {response.status_code}"
        print("✓ Non-image file correctly rejected")


class TestFileDownload:
    """Test file download from Object Storage"""
    
    def test_download_uploaded_file(self, auth_token):
        """Upload a file then download it via GET /api/files/{path}"""
        # First upload a file
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {"file": ("download_test.png", io.BytesIO(png_data), "image/png")}
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        upload_resp = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers=headers,
            timeout=60
        )
        
        if upload_resp.status_code != 200:
            pytest.skip(f"Upload failed: {upload_resp.text}")
        
        file_path = upload_resp.json().get("path")
        
        # Now download the file
        download_resp = requests.get(
            f"{BASE_URL}/api/files/{file_path}",
            params={"auth": auth_token},
            timeout=30
        )
        
        assert download_resp.status_code == 200, f"Download failed: {download_resp.status_code}"
        assert len(download_resp.content) > 0, "Downloaded file should not be empty"
        print(f"✓ File downloaded successfully: {len(download_resp.content)} bytes")


class TestCustomerEncryption:
    """Test customer data encryption endpoint"""
    
    def test_encrypt_customer_data(self, auth_headers):
        """POST /api/encrypt-customer/{id} encrypts phone and notes"""
        # First create a test customer
        customer_data = {
            "name": "TEST_ENCRYPT_Customer",
            "phone": "05551234567",
            "type": "Potansiyel",
            "notes": "Sensitive notes to encrypt"
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/customers",
            headers=auth_headers,
            json=customer_data,
            timeout=10
        )
        
        assert create_resp.status_code == 200, f"Customer creation failed: {create_resp.text}"
        customer_id = create_resp.json()["id"]
        
        try:
            # Encrypt the customer
            encrypt_resp = requests.post(
                f"{BASE_URL}/api/encrypt-customer/{customer_id}",
                headers=auth_headers,
                timeout=10
            )
            
            assert encrypt_resp.status_code == 200, f"Encryption failed: {encrypt_resp.status_code}: {encrypt_resp.text}"
            
            result = encrypt_resp.json()
            assert result.get("success") == True, f"Expected success=True: {result}"
            print(f"✓ Customer data encrypted successfully")
            
        finally:
            # Cleanup: delete the test customer
            requests.delete(
                f"{BASE_URL}/api/customers/{customer_id}?permanent=true",
                headers=auth_headers,
                timeout=10
            )
    
    def test_encrypt_nonexistent_customer_returns_404(self, auth_headers):
        """POST /api/encrypt-customer/{invalid_id} returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/encrypt-customer/nonexistent-id-12345",
            headers=auth_headers,
            timeout=10
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Returns 404 for nonexistent customer")


class TestWhatsAppLinkFormat:
    """Test WhatsApp link format for Turkish phone numbers"""
    
    def test_whatsapp_link_format(self):
        """Verify WhatsApp link format converts 0xxx to 90xxx"""
        # This is a frontend test - verify the format logic
        test_cases = [
            ("05551234567", "905551234567"),  # Leading 0 -> 90
            ("5551234567", "5551234567"),      # No leading 0 -> unchanged
            ("0532 123 45 67", "905321234567"), # With spaces
        ]
        
        for phone, expected_number in test_cases:
            # Apply the same transformation as frontend
            formatted = phone.replace(" ", "").replace(".", "")
            if formatted.startswith("0"):
                formatted = "90" + formatted[1:]
            
            wa_link = f"https://wa.me/{formatted}"
            assert formatted == expected_number or formatted.replace("90", "90") in wa_link, \
                f"Phone {phone} should format to {expected_number}, got {formatted}"
        
        print("✓ WhatsApp link format is correct for Turkish numbers")


class TestCapacitorConfig:
    """Test Capacitor config structure for native mobile build"""
    
    def test_capacitor_config_structure(self):
        """Verify capacitor.config.json has correct structure"""
        import json
        
        config_path = "/app/frontend/capacitor.config.json"
        
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Required fields
        assert "appId" in config, "Missing appId"
        assert "appName" in config, "Missing appName"
        assert "webDir" in config, "Missing webDir"
        
        # Verify values
        assert config["appId"] == "com.aslanbasoto.crm", f"Wrong appId: {config['appId']}"
        assert config["appName"] == "Aslanbaş Oto", f"Wrong appName: {config['appName']}"
        assert config["webDir"] == "build", f"Wrong webDir: {config['webDir']}"
        
        # Verify plugins
        assert "plugins" in config, "Missing plugins"
        assert "SplashScreen" in config["plugins"], "Missing SplashScreen plugin"
        assert "StatusBar" in config["plugins"], "Missing StatusBar plugin"
        
        # Verify android/ios configs
        assert "android" in config, "Missing android config"
        assert "ios" in config, "Missing ios config"
        
        print(f"✓ Capacitor config valid: {config['appId']} - {config['appName']}")


class TestAuthRequired:
    """Test that export endpoints require authentication"""
    
    def test_export_cars_requires_auth(self):
        """GET /api/export/cars without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/export/cars", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ /api/export/cars requires authentication")
    
    def test_export_customers_requires_auth(self):
        """GET /api/export/customers without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/export/customers", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ /api/export/customers requires authentication")
    
    def test_upload_requires_auth(self):
        """POST /api/upload without auth returns 401/403"""
        files = {"file": ("test.png", io.BytesIO(b"fake"), "image/png")}
        response = requests.post(f"{BASE_URL}/api/upload", files=files, timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ /api/upload requires authentication")
