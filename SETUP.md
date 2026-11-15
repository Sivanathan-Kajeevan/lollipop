# Lollipop Restaurant — Digital Menu & Ordering Setup Guide

Lollipop is a mobile-first restaurant menu, ordering, and QR verification system built for Sri Lankan dining.

## Key Capabilities

- **Customer Menu & Cart (`/`)**: Mobile-first Sri Lankan menu with instant search, category tabs (`All`, `Breakfast`, `Lunch`, `Dinner`, `Special`, plus custom admin categories), inline add/quantity controls, dish detail modal with quantity & preparation notes, sticky bottom cart bar, and WhatsApp contact (`072 804 4969` → `https://wa.me/94728044969`).
- **Cart & Order Submission (`/cart`)**: Review items, adjust quantities or notes, validate Sri Lankan mobile numbers (local `07X` and international `+947X` formats), recheck server-side prices and availability, and submit orders with duplicate-submission protection.
- **Order Confirmation & Unique Order QR (`/order/:customerToken`)**: Generates an unpredictable tokenised QR code linking directly to staff verification, displays live order & payment status updates in `Asia/Colombo` time, and provides **Download QR**, **Print Order**, and **Back to Menu**.
- **Staff Admin & Order QR Scanner (`/admin`)**:
  - **Overview**: Live counts for New orders, Active orders, Completed orders, Total foods, Available foods, and Unavailable foods.
  - **Orders**: Live updating order queue with search, status/payment/date filters, status timeline (`New`, `Accepted`, `Preparing`, `Ready`, `Completed`, `Cancelled`), and independent `Unpaid` / `Paid` tracking.
  - **Scan Order QR**: Rear-camera live QR scanner, QR image upload decoder, and manual order-reference lookup with tap-to-call and WhatsApp actions. Unauthenticated scans require staff login before revealing customer contact details.
  - **Foods & Categories**: Full menu CRUD with persistent image uploads, display ordering, visibility toggles, and safe category deletion with mandatory food reassignment. Historical order snapshots remain intact even if dishes are later edited or deleted.
  - **Restaurant Settings & Menu QR Generator**: Update restaurant branding, WhatsApp number, optional address/hours, and download/print high-contrast PNG/SVG Menu QR table stands (**"Scan to View Menu & Order"**).

## Environment Variables & Initial Admin Setup

Copy `.env.example` to `.env` if you want to configure environment variables explicitly:

| Variable | Description | Default |
| --- | --- | --- |
| `PUBLIC_MENU_URL` | Canonical HTTPS URL encoded in QR codes | Auto-detected from `APP_URL` or active request host |
| `SESSION_SECRET` | Secret key for signing `HttpOnly` admin session cookies | Persisted generated secret in `data/.session_secret` |
| `ADMIN_USERNAME` | Admin sign-in username | `admin` |
| `ADMIN_PASSWORD` | Optional preconfigured admin password | If unset, `/admin/login` runs a secure one-time **Initial Admin Setup** |

## Running Locally & Deploying

```bash
npm install
npm run test       # Run unit tests for pricing, mobile validation, Colombo time & QR payload parsing
npm run dev        # Start Express + Vite dev server on port 3000
npm run build      # Build production bundle into dist/
npm run start      # Start production server on port 3000
```

> **Note on Camera QR Scanning**: Mobile browsers require **HTTPS** (or `localhost` during local testing) to grant camera permission for live QR scanning.
