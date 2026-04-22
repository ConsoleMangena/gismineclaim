# 📍 GIS-Based Mine Claim Conflict Detection System

## 🧠 Overview

This project is a **Spatial Decision Support System (SDSS)** designed to detect and analyze conflicts between **mine claims and agricultural land parcels** using GIS techniques.

The system uses a **Node.js (Express) REST API** backend, **React** frontend, and **PostgreSQL/PostGIS** spatial database to identify overlaps, proximity risks, and dispute hotspots — delivered as a full-stack web application.

---

## 🎯 Objectives

* Detect spatial conflicts between mine claims and farm boundaries
* Identify high-risk zones using proximity (buffer analysis)
* Analyze dispute patterns using hotspot analysis
* Provide visual decision-support maps for land management

---

## 🏗️ System Architecture

### 1. Data Layer

Raw spatial and non-spatial data inputs:

* Mine claim boundaries
* Farm parcel boundaries
* Administrative boundaries
* Survey and ownership records

**Formats:** Shapefiles, CSV, GPS coordinates

---

### 2. Storage Layer

* **Database:** Supabase (hosted PostgreSQL with **PostGIS** extension)
* Managed via SQL/PostGIS queries in Node.js
* Frontend also has direct Supabase JS client access

**Core Tables:**

* `users_user` — id, username, email, password, role (ADMIN/SURVEYOR/OFFICER)
* `spatial_data_owner` — id, name, national_id, contact_info
* `spatial_data_mineclaim` — id, claim_code, owner_id (FK), area, status, geom (POLYGON)
* `spatial_data_farmparcel` — id, parcel_code, owner_id (FK), land_use, area, geom (POLYGON)
* `spatial_data_boundary` — id, name, boundary_type, geom (MULTIPOLYGON)
* `disputes_dispute` — id, mine_claim_id (FK), farm_parcel_id (FK), conflict_area, status, geom (POLYGON)
* `disputes_hotspot` — id, intensity, dispute_count, geom (POLYGON)

---

### 3. Processing Layer

Handled in the **Node.js backend** using PostGIS spatial queries

#### Key Spatial Operations:

* **Overlay Analysis (Intersection)**
  Detects overlapping boundaries (conflicts)

* **Buffer Analysis**
  Identifies proximity-based risk zones

* **Hotspot Analysis**
  Detects clusters of dispute occurrences

* **Topology Rules**
  Ensures spatial data integrity:

  * No overlaps within same layer
  * No gaps
  * Valid geometries

---

### 4. Output Layer

* Interactive conflict maps (React + Leaflet)
* Hotspot maps
* Attribute tables (dispute records)
* REST API endpoints for spatial data (GeoJSON)

---

## 🔄 Workflow

1. **Data Collection**

   * GPS surveys
   * Existing cadastral records

2. **Data Preparation**

   * Upload via React frontend or API
   * Cleaning and validation in backend

3. **Data Storage**

   * Stored in PostgreSQL/PostGIS database

4. **Spatial Analysis**

   * Intersection → detect conflicts
   * Buffer → detect risk zones
   * Hotspot → detect patterns

5. **Validation**

   * Apply topology rules
   * Fix geometry errors

6. **Visualization**

   * Interactive web maps via React + Leaflet

7. **Decision Support**

   * Outputs used for dispute resolution and planning

---

## 🧩 Core Logic

### Conflict Detection

```
IF mine_claim.geometry INTERSECTS farm_parcel.geometry
THEN conflict = TRUE
```

### Risk Detection

```
IF distance(mine_claim, farm_parcel) < threshold
THEN risk = HIGH
```

### Hotspot Detection

```
GROUP disputes BY location
COUNT frequency
IDENTIFY clusters
```

---

## 🛠️ Tools & Technologies

* **Backend:** Node.js, Express, PostgreSQL (`pg`), JWT
* **Frontend:** React, Leaflet, Tailwind CSS
* **Database:** PostgreSQL + PostGIS
* **API Format:** REST (GeoJSON)
* **Spatial Concepts:**

  * Overlay Analysis (ST_Intersects)
  * Buffering (ST_Buffer)
  * Topology Rules
  * Hotspot Analysis

---

## 📊 Use Cases

* Land dispute detection
* Mining claim validation
* Agricultural land protection
* Government land administration support

---

## ⚠️ Limitations

* No real-time GPS data streaming (manual upload)
* Hotspot analysis is basic (density-based, not Getis-Ord)
* Role-based access control is basic (no permission enforcement yet)
* No mobile-responsive map UI yet

---

## 🚀 Future Improvements

* Role-based access control and user authentication
* Real-time GPS data ingestion
* Mobile-responsive map interface
* Advanced hotspot analysis (Getis-Ord Gi*)
* Integration with national cadastral systems
* Deployment via Docker + CI/CD

---

## 🧩 Backend Modules

| App | Responsibility |
|---|---|
| `users` | Authentication & roles (Admin, Surveyor, Officer) |
| `spatial_data` | Core GIS entities: Owner, MineClaim, FarmParcel, Boundary |
| `disputes` | Conflict records, overlap tracking, hotspots |
| `analysis` | GIS engine — intersection, buffer, hotspot services |
| `reports` | CSV exports, summary statistics |

---

## 🔌 API Endpoints

```
/api/users/                          # User CRUD
/api/owners/                         # Owner CRUD
/api/mine-claims/                    # Mine claim CRUD (GeoJSON)
/api/farm-parcels/                   # Farm parcel CRUD (GeoJSON)
/api/boundaries/                     # Boundary CRUD (GeoJSON)
/api/disputes/                       # Dispute CRUD (GeoJSON)
/api/hotspots/                       # Hotspot read-only (GeoJSON)
/api/analysis/run-conflict-detection/   # POST — detect overlaps
/api/analysis/buffer-risks/             # GET — proximity risk pairs
/api/analysis/run-hotspot-analysis/     # POST — generate hotspots
/api/reports/summary/                   # GET — dashboard stats
/api/reports/disputes/csv/              # GET — disputes CSV export
/api/reports/mine-claims/csv/           # GET — mine claims CSV export
/api/reports/farm-parcels/csv/          # GET — farm parcels CSV export
```

---

## 📂 Project Structure

```
gismineclaim/
├── backend/
│   ├── src/server.js       # Express API routes and PostGIS queries
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/     # Navbar, MapView, StatusBadge
│   │   ├── pages/          # Dashboard, MapPage, ClaimsPage, DisputesPage
│   │   ├── services/       # API service layer
│   │   └── App.jsx
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```

---

## 🚀 Setup Instructions

### Prerequisites

* Python 3.10+
* Node.js 18+
* Supabase account (provides hosted PostgreSQL + PostGIS)

### Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Enable PostGIS extension: **Database → Extensions → search "postgis" → Enable**
3. Copy your database password from project settings

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with DB credentials and JWT secrets
npm install
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
# .env already contains VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

---

## 📌 Summary

This system transforms land conflict management into a **spatial analysis problem**, enabling more accurate, faster, and data-driven decision-making using a modern full-stack web application powered by Node.js, React, and Supabase (PostGIS).
