# Test Credentials — MACTech Oto Galeri CRM

## Test Hesabı (testing_agent_v3_fork iter 30 tarafından oluşturuldu)
- **Email:** test_branch_6b287ede@test.com
- **Password:** Password123!
- **Company Name:** Branch Test 6b287ede

## Notlar
- Login butonu Türkçe "GİRİŞ YAP" metni içeriyor (büyük dotted İ). Otomasyonda `button[type='submit']` selector'ı kullanın.
- Login sayfasında "Kayıt Ol" linki YOKTUR (kullanıcı isteği). Yeni hesap oluşturmak için doğrudan `POST /api/auth/register` kullanın:
  ```
  curl -X POST $BACKEND_URL/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"x@y.com","password":"pass","company_name":"Test","phone":"5555555555"}'
  ```
- QR Login akışı `/api/auth/qr/generate` endpoint üzerinden çalışır.

## Production / Asıl Kullanıcı
- Email: macitsaitufuk@gmail.com
- Login yöntemi: SSO (mactech.tr)
