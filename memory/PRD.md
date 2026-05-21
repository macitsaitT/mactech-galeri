# MACTech Oto Galeri CRM - PRD

**Versiyon:** v5.31 (Iter 62)  
**Son Güncelleme:** 2026-02

## Original Problem Statement
Multi-tenant Türkiye odaklı oto galeri CRM (MACTech ekosistemi M-Gallery modülü).
Araç envanteri, müşteri yönetimi, dijital sözleşmeler, çoklu şube, finansal raporlama.
**Kritik kural:** Emergent altyapısına bağımlılık YOK (emergentintegrations kaldırıldı).

## Tech Stack
- **Frontend:** React 19 + Tailwind + Shadcn/UI + Radix
- **Backend:** FastAPI + Motor (MongoDB async) + PyJWT + bcrypt
- **DB:** MongoDB (`mactech_gallery`), 19 collection, soft-delete
- **Auth:** Hybrid - MacTech SSO (httpx) + Yerel JWT (HS256, 7d)
- **Integrations:** Resend (e-posta), Stripe (dormant), APScheduler

## Completed (Iter 62)
- Kurumsal Teknik Dokümantasyon (`/app/MACTECH_TECHNICAL_DOCUMENTATION.md`) - Markdown + DOCX
- Download endpoint: `GET /api/docs/technical` (.docx response)

## Completed (Iter 50-61)
- Tüm `emergentintegrations` ve AI/OCR bağımlılıkları kaldırıldı
- Dijital Sözleşmeler (Kapora/Teslim/Satış) + canvas imza + backend persistence
- Dashboard 4-tile sermaye hiyerarşisi + yıl filtresi + StockExpensesDetailModal
- Dashboard/ReportModal modüler refactor
- `sold_by_user_id` retroactive migration
- Customer-scoped Contract History
- CashFlowVisual gider ayrımı (İşletme vs Stok Yatırımı)

## Backlog
- **P1:** GA4 + Meta Pixel entegrasyonu (GTM container ID gerekir)
- **P2:** Doküman görselleştirme (Mermaid diyagramlar)
- **P2:** Background scheduler installment due_date tracking
- **P3:** Iyzico ödeme entegrasyonu (Stripe yerine TR-friendly)

## Bilinen Sorun Yok
- Backend regression suite: 22/22 pass
- Login healthy (kullanıcı önceki claim'i lokal cache idi)

## Key Files
- `/app/MACTECH_TECHNICAL_DOCUMENTATION.md` (+ .docx)
- `/app/backend/server.py` (download endpoint)
- `/app/backend/routes/contracts.py`
- `/app/frontend/src/components/modals/ContractModal.jsx`
