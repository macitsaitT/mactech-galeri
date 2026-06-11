# MACTech Oto-Cari CRM - PRD

**Versiyon:** v6.0 (Iter 65 — Muhasebe Prensipli Finansal Reform)
**Son Güncelleme:** 2026-06-11

## Original Problem Statement
Multi-tenant Türkiye odaklı oto galeri CRM. **Oto-Cari Otomotiv • Powered by MacTech** markası.
Araç envanteri, müşteri yönetimi, dijital sözleşmeler, çoklu şube, **MUHASEBE PRENSİPLİ** finansal raporlama.
**Kritik kural:** Emergent altyapısına bağımlılık YOK.

## Tech Stack
- **Frontend:** React 19 + Tailwind + Shadcn/UI
- **Backend:** FastAPI + Motor (MongoDB async) + PyJWT
- **DB:** MongoDB (`mactech_gallery`), 19 collection
- **Auth:** Hybrid MacTech SSO + Yerel JWT

## Completed (Iter 67 — Detay Modalları + Etkileşim)
- **OperatingBreakdownModal** — "Dönem İşletme Gideri" kartına tıklanınca açılır:
  - Pasta grafiği (renk-kodlu kategoriler)
  - Sıralı tablo + yüzde barları
  - Tarih aralığı bilgisi + kafa karışıklığı önleyici uyarı notu
- StatCard'a `onClick` desteği eklendi (interaktif kartlar için button tag, hover/active state)

## Completed (Iter 66 — ReportModal Ayrımı + Branding)
- **ReportModal** "Gider Raporu" ayrımı:
  - `operating` → İşletme Gideri Raporu (Kira/Maaş/Reklam/Vergi)
  - `investment` → Araç Yatırımı Raporu (alış + araç-bağlı maliyetler)
  - Mevcut `expenses` (Araç Masrafları) geriye uyumluluk için korundu
  - `utils/expenseClassifier.js` — backend ile birebir uyumlu frontend sınıflandırma
- **Branding: Ti-Cari → Oto-Cari** tüm metinsel referanslar:
  - LoginPage footer, SSO callback, notifications.js, digest.py (e-posta)
  - index.css yorum/token comment'leri
  - `oto-cari-mark.png` asset (logo512'den 256×256 turncate)
  - `components/brand/Logo.jsx` silindi (artık doğrudan `<img>` kullanılıyor)
  - Eski `ti-cari-*.png` asset'leri public/ klasöründe kaldı (sıfır referans)

## Completed (Iter 65)
- **MUHASEBE PRENSİPLİ FİNANSAL REFORM** — `services/expense_classifier.py` ile 3-sınıf kategori sistemi (vehicle_cost / operating / neutral)
- Yeni `/api/finance/summary` endpoint — 6 kart için tek-doğruluk-kaynağı
- Yeni `FinanceSummaryCards.jsx` — 6 muhasebe kartı: Başlangıç Sermayesi, Güncel Öz Sermaye, Kasadaki Nakit, Stok Araç Değeri, Net Kâr, Toplam Varlık
- `FoundingCapitalModal` — başlangıç sermayesi tanımlama
- Dashboard'da eski karmaşık 4-tile + 5-stat grid kaldırıldı, net 6 kart + 4 operasyonel kart
- Formül: `Güncel Öz Sermaye = Başlangıç + Net Kâr − İşletme Giderleri`
- Negatif kasa açıklaması: "Kasadan çıkan para stoktaki araçlara bağlanmıştır"
- Araç alımları artık "gider" olarak gösterilmiyor, varlık olarak

## Completed (Iter 60-64)
- Branding: Ti-Cari → Oto-Cari logo/favicon/PWA güncellemeleri
- Sidebar yatay logo (h-20, 3:1 aspect crop)
- Login full transparent vertical logo + "Powered by MacTech" imzası
- Kurumsal Teknik Dokümantasyon + Reklam Vitrini dokümanları (.md + .docx)
- `/api/docs/technical` ve `/api/docs/marketing` download endpoint'leri
- Dijital sözleşmeler, customer-scoped contract history
- emergentintegrations bağımlılıkları kaldırıldı

## Backlog
- **P1:** GA4 + Meta Pixel entegrasyonu (GTM ID gerekir)
- **P2:** Marka adı `Ti-Cari` → `Oto-Cari` tüm metinsel ref'lar (footer, e-posta digest, browser title)
- **P2:** Migration script — geçmiş tx'lere `expense_type` field'ı ekle (şu an runtime classify yapılıyor, performans için cache edilebilir)
- **P2:** ReportModal — "Gider Raporu" → "İşletme Gideri" + "Araç Yatırım" ayrı raporlar
- **P3:** Iyzico ödeme entegrasyonu

## Bilinen Sorun Yok
- Backend regression suite: 22/22 pass
- Login healthy, finance summary endpoint çalışıyor

## Key Files
- `/app/backend/services/expense_classifier.py` (YENİ)
- `/app/backend/routes/finance.py` (YENİ)
- `/app/frontend/src/components/dashboard/FinanceSummaryCards.jsx` (YENİ)
- `/app/frontend/src/components/modals/FoundingCapitalModal.jsx` (YENİ)
- `/app/frontend/src/pages/Dashboard.jsx` (güncellendi)
- `/app/MACTECH_TECHNICAL_DOCUMENTATION.md`
- `/app/OTO_CARI_REKLAM_VITRINI.md`
