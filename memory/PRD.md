# Aslanbaş Oto - Galeri CRM PRD

## Project Overview
- **Project Name:** Aslanbaş Oto Galeri CRM
- **Version:** 5.2.0
- **Last Updated:** 2026-02-20
- **Status:** MVP Complete + Modular Backend + Security Hardening + Year-End Transfer

## Original Problem Statement
Kullanıcı, GitHub'daki mevcut Galeri CRM uygulamasını profesyonelleştirmek ve Play Store/App Store'a yüklemek istedi.

## Implementation Status

### v5.2.0 - Yıl Sonu Devri (Year-End Carryover)
- [x] Backend: POST /api/year-end-transfer (admin only, duplicate prevention)
- [x] Backend: GET /api/year-end-transfers (transfer history)
- [x] Frontend: YearEndTransferPage with year selector, financial summary, confirmation dialog, transfer history
- [x] Sidebar menu item (admin only): CalendarClock icon
- [x] "Devir Bakiye" transaction created as income/expense dated Jan 1 of next year
- [x] Previous carryover amounts included in calculation
- [x] Password hint updated to "En az 8 karakter" on login page
- [x] 22/22 tests passed (14 backend + 8 frontend)

### v5.1.0 - Security Hardening
- [x] Rate Limiting, Input Validation, MongoDB Injection Prevention
- [x] File Upload Magic Bytes, Security Headers, Sensitive Data Protection
- [x] 26/26 tests passed

### v5.0.0 - Backend Modular Refactoring
- [x] Monolithic server.py -> modular structure (113 lines entry point)
- [x] 51/51 tests passed

### v4.0-4.10 - Core Features
- [x] Multi-tenant architecture, RBAC, Dashboard, CRUD
- [x] Word/PDF export, Tanıtım Kartı, Ekspertiz diagram, PWA
- [x] Phone formatting, Customer cleanup, Report mobile optimization

## Code Architecture (v5.2)
```
/app/backend/
├── server.py              # Entry point
├── db.py, auth.py, models.py, helpers.py, encryption.py, storage.py, security.py
└── routes/
    ├── auth_routes.py, cars.py, customers.py, transactions.py
    ├── appointments.py, users.py, stats.py, uploads.py
    ├── exports.py, encryption_routes.py
    └── year_end.py        # NEW: Year-end carryover
```

## DB Schema
- **users, cars, customers, transactions, permissions** (unchanged)
- **year_end_transfers:** `{ id, org_id, year, total_income, total_expense, previous_carryover, net_balance, transfer_type, transfer_amount, transaction_id, created_by, created_at }`

## Prioritized Backlog
### P1
- [ ] Real email verification (MOCKED)
- [ ] Capacitor native build

### P2
- [ ] Google Social Login (MOCKED)

### P3
- [ ] AI vehicle valuation
- [ ] Push notifications
- [ ] Sales performance reports

## Mocked Services
- Email sending (verification & reminders)
- Google Authentication

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn/UI, Recharts
- Backend: FastAPI, Python, MongoDB (motor), python-docx, reportlab, slowapi
- Storage: Emergent Object Storage
