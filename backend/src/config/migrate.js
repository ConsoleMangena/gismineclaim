const dotenv = require('dotenv')
dotenv.config()

const { pool, ensureNodeUsersTable } = require('./db')

// ─── CREATE from scratch ─────────────────────────────────────────
const CREATE_ALL = `
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Owners
CREATE TABLE IF NOT EXISTS spatial_data_owner (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  national_id VARCHAR(50) UNIQUE NOT NULL,
  phone VARCHAR(30) DEFAULT '',
  email VARCHAR(254) DEFAULT '',
  address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mine Claims
CREATE TABLE IF NOT EXISTS spatial_data_mineclaim (
  id BIGSERIAL PRIMARY KEY,
  claim_code VARCHAR(100) UNIQUE NOT NULL,
  claim_name VARCHAR(255) DEFAULT '',
  claim_reg_no VARCHAR(100) DEFAULT '',
  mine_type VARCHAR(100) DEFAULT '',
  owner_id BIGINT NOT NULL REFERENCES spatial_data_owner(id) ON DELETE CASCADE,
  area DOUBLE PRECISION,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  district VARCHAR(150) DEFAULT '',
  surveyed_date DATE,
  surveyor VARCHAR(255) DEFAULT '',
  coordinate_system VARCHAR(50) DEFAULT 'WGS84',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom geometry(Geometry, 4326)
);

-- Farm Parcels
CREATE TABLE IF NOT EXISTS spatial_data_farmparcel (
  id BIGSERIAL PRIMARY KEY,
  parcel_code VARCHAR(100) UNIQUE NOT NULL,
  farm_name VARCHAR(255) DEFAULT '',
  deed_no VARCHAR(100) DEFAULT '',
  lease_type VARCHAR(50) DEFAULT '',
  owner_id BIGINT NOT NULL REFERENCES spatial_data_owner(id) ON DELETE CASCADE,
  land_use VARCHAR(100) DEFAULT '',
  area DOUBLE PRECISION,
  survey_date DATE,
  surveyor VARCHAR(255) DEFAULT '',
  coordinate_system VARCHAR(50) DEFAULT 'WGS84',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom geometry(Geometry, 4326)
);

-- Boundaries
CREATE TABLE IF NOT EXISTS spatial_data_boundary (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  boundary_type VARCHAR(100) NOT NULL,
  geom geometry(MultiPolygon, 4326)
);

-- Disputes
CREATE TABLE IF NOT EXISTS disputes_dispute (
  id BIGSERIAL PRIMARY KEY,
  mine_claim_id BIGINT NOT NULL REFERENCES spatial_data_mineclaim(id) ON DELETE CASCADE,
  farm_parcel_id BIGINT NOT NULL REFERENCES spatial_data_farmparcel(id) ON DELETE CASCADE,
  conflict_area DOUBLE PRECISION,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  geom geometry(Polygon, 4326)
);

-- Mine-to-Mine Disputes
CREATE TABLE IF NOT EXISTS disputes_mine_mine (
  id BIGSERIAL PRIMARY KEY,
  mine_claim_a_id BIGINT NOT NULL REFERENCES spatial_data_mineclaim(id) ON DELETE CASCADE,
  mine_claim_b_id BIGINT NOT NULL REFERENCES spatial_data_mineclaim(id) ON DELETE CASCADE,
  conflict_area DOUBLE PRECISION,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  geom geometry(Polygon, 4326)
);

-- Hotspots
CREATE TABLE IF NOT EXISTS disputes_hotspot (
  id BIGSERIAL PRIMARY KEY,
  intensity DOUBLE PRECISION,
  dispute_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom geometry(Polygon, 4326)
);

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_mineclaim_geom ON spatial_data_mineclaim USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_farmparcel_geom ON spatial_data_farmparcel USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_boundary_geom ON spatial_data_boundary USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_dispute_geom ON disputes_dispute USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_mine_mine_dispute_geom ON disputes_mine_mine USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_hotspot_geom ON disputes_hotspot USING GIST (geom);
`

async function seedAdmin() {
  const bcrypt = require('bcryptjs')
  const existing = await pool.query("SELECT id FROM node_users WHERE username = 'admin' LIMIT 1")
  if (existing.rowCount > 0) {
    console.log('ℹ️  Admin user already exists, skipping seed.')
    return
  }
  const hash = await bcrypt.hash('admin1234', 12)
  await pool.query(
    `INSERT INTO node_users (username, email, password_hash, first_name, last_name, role)
     VALUES ('admin', 'admin@gismineclaim.co.zw', $1, 'System', 'Admin', 'ADMIN')`,
    [hash]
  )
  console.log('✅ Admin user created — username: admin / password: admin1234')

  // Seed a regular user account
  const userHash = await bcrypt.hash('user1234', 12)
  await pool.query(
    `INSERT INTO node_users (username, email, password_hash, first_name, last_name, role)
     VALUES ('user', 'user@gismineclaim.co.zw', $1, 'Test', 'User', 'USER')
     ON CONFLICT (username) DO NOTHING`,
    [userHash]
  )
  console.log('✅ Test user created — username: user / password: user1234')
}

async function seedKwekweData() {
  const existing = await pool.query('SELECT COUNT(*)::int AS c FROM spatial_data_owner')
  if (existing.rows[0].c > 0) {
    console.log('ℹ️  Sample data already exists, skipping seed.')
    return
  }

  console.log('Seeding Kwekwe sample data...')

  // ─── Owners (7 owners) ─────────────────────────────────────────
  const owners = await pool.query(`
    INSERT INTO spatial_data_owner (name, national_id, phone, email, address) VALUES
      ('Tendai Moyo',       '29-123456A78', '+263 771 234 567', 'tendai.moyo@gmail.com',     '12 Robert Mugabe Way, Kwekwe'),
      ('Grace Sibanda',     '29-234567B89', '+263 772 345 678', 'grace.sibanda@yahoo.com',   '45 Harare Rd, Kwekwe'),
      ('Rumbidzai Chikore', '29-456789D01', '+263 774 567 890', 'rchikore@minecorp.co.zw',   'Farm Lot 3, Kwekwe Rural'),
      ('Blessing Maphosa',  '29-567890E12', '+263 775 678 901', 'blessing.m@agrimail.co.zw', 'Plot 22, Sebakwe, Kwekwe'),
      ('Farai Dzimba',      '29-678901F23', '+263 776 789 012', 'farai.dzimba@gmail.com',    '9 Fifth Street, Kwekwe'),
      ('Nyasha Mutendi',    '29-789012G34', '+263 777 890 123', 'nyasha.m@farmmail.co.zw',   'Patchway Farm, Kwekwe'),
      ('Chenai Gumbo',      '29-890123H45', '+263 778 901 234', 'chenai.g@goldmine.co.zw',   '3 Globe & Phoenix Rd, Kwekwe')
    RETURNING id
  `)
  // oid[0]=Tendai, oid[1]=Grace, oid[2]=Rumbidzai, oid[3]=Blessing,
  // oid[4]=Farai, oid[5]=Nyasha, oid[6]=Chenai
  const oid = owners.rows.map(r => Number(r.id))

  // ─── Mine Claims (Kwekwe outskirts — rural mining areas) ─────────
  // Kwekwe town centre ≈ -18.928, 29.815.  All mines placed 15–30 km out.
  await pool.query(`
    INSERT INTO spatial_data_mineclaim
      (claim_code, claim_name, claim_reg_no, mine_type, owner_id, area, status, district, surveyed_date, surveyor, coordinate_system, geom)
    VALUES
      -- Zone A: North-Northwest (Globe & Phoenix mining area, ~20 km N)
      ('MC-KWE-001', 'Globe & Phoenix Gold',   'REG/2023/0451', 'Gold',     ${oid[0]}, 125.50, 'ACTIVE',   'Kwekwe', '2023-06-15', 'J. Mapuranga (SG)',  'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.720,-18.820],[29.738,-18.820],[29.738,-18.832],[29.720,-18.832],[29.720,-18.820]]]}'), 4326)),

      ('MC-KWE-012', 'Kwekwe Central Platinum', 'REG/2023/0710', 'Platinum', ${oid[0]}, 92.00,  'ACTIVE',   'Kwekwe', '2023-03-18', 'J. Mapuranga (SG)', 'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.740,-18.815],[29.756,-18.815],[29.756,-18.828],[29.740,-18.828],[29.740,-18.815]]]}'), 4326)),

      -- Zone B: East (Munyati / Doris area, ~15 km E)
      ('MC-KWE-002', 'Doris Gold Claim',       'REG/2023/0452', 'Gold',     ${oid[1]}, 87.30,  'DISPUTED', 'Kwekwe', '2023-08-22', 'T. Chigumba (SG)',  'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.870,-18.860],[29.888,-18.860],[29.888,-18.875],[29.870,-18.875],[29.870,-18.860]]]}'), 4326)),

      ('MC-KWE-006', 'Munyati Gold Reef',      'REG/2023/0599', 'Gold',     ${oid[4]}, 98.20,  'DISPUTED', 'Kwekwe', '2023-11-02', 'T. Chigumba (SG)',  'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.930,-18.870],[29.948,-18.870],[29.948,-18.888],[29.930,-18.888],[29.930,-18.870]]]}'), 4326)),

      -- Zone C: Northeast (Chrome belt toward Kadoma, ~20 km NE)
      ('MC-KWE-003', 'Indarama Chrome',        'REG/2024/0078', 'Chrome',   ${oid[6]}, 210.00, 'DISPUTED', 'Kwekwe', '2024-01-10', 'R. Nkomo (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.880,-18.810],[29.905,-18.810],[29.905,-18.820],[29.880,-18.820],[29.880,-18.810]]]}'), 4326)),

      ('MC-KWE-005', 'Zim Alloys Block A',     'REG/2024/0112', 'Chrome',   ${oid[6]}, 340.00, 'DISPUTED', 'Kwekwe', '2024-04-18', 'S. Moyo (SG)',      'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.870,-18.825],[29.900,-18.825],[29.900,-18.852],[29.870,-18.852],[29.870,-18.825]]]}'), 4326)),

      ('MC-KWE-009', 'Kadoma Gold Extension',  'REG/2024/0415', 'Gold',     ${oid[2]}, 145.00, 'DISPUTED', 'Kwekwe', '2024-08-05', 'J. Mapuranga (SG)', 'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.960,-18.810],[29.985,-18.810],[29.985,-18.830],[29.960,-18.830],[29.960,-18.810]]]}'), 4326)),

      -- Zone D: West (Zhombe area, ~25 km W)
      ('MC-KWE-010', 'Zhombe Chrome Claim',    'REG/2024/0520', 'Chrome',   ${oid[3]}, 190.00, 'DISPUTED', 'Kwekwe', '2024-09-12', 'R. Nkomo (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.580,-18.920],[29.610,-18.920],[29.610,-18.945],[29.580,-18.945],[29.580,-18.920]]]}'), 4326)),

      ('MC-KWE-014', 'Mbizo Iron Ore',         'REG/2024/0055', 'Iron',     ${oid[1]}, 310.00, 'ACTIVE',   'Kwekwe', '2024-01-22', 'S. Moyo (SG)',      'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.640,-18.900],[29.665,-18.900],[29.665,-18.920],[29.640,-18.920],[29.640,-18.900]]]}'), 4326)),

      -- Zone E: Southwest (Patchway / Sebakwe, ~20 km SW)
      ('MC-KWE-007', 'Patchway Nickel',        'REG/2024/0203', 'Nickel',   ${oid[5]}, 175.00, 'ACTIVE',   'Kwekwe', '2024-02-28', 'R. Nkomo (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.700,-18.980],[29.722,-18.980],[29.722,-18.998],[29.700,-18.998],[29.700,-18.980]]]}'), 4326)),

      ('MC-KWE-004', 'Sebakwe Gold',           'REG/2022/0310', 'Gold',     ${oid[2]}, 56.80,  'EXPIRED',  'Kwekwe', '2022-03-05', 'J. Mapuranga (SG)',  'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.730,-19.010],[29.748,-19.010],[29.748,-19.025],[29.730,-19.025],[29.730,-19.010]]]}'), 4326)),

      ('MC-KWE-015', 'Redcliff Limestone',     'REG/2023/0822', 'Other',    ${oid[4]}, 78.50,  'ACTIVE',   'Kwekwe', '2023-12-12', 'T. Chigumba (SG)', 'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.760,-19.020],[29.778,-19.020],[29.778,-19.035],[29.760,-19.035],[29.760,-19.020]]]}'), 4326)),

      -- Zone F: Far Southwest (Silobela, ~30 km SW)
      ('MC-KWE-011', 'Silobela Lithium',       'REG/2024/0633', 'Lithium',  ${oid[6]}, 220.00, 'DISPUTED', 'Kwekwe', '2024-10-20', 'T. Chigumba (SG)', 'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.550,-19.060],[29.580,-19.060],[29.580,-19.085],[29.550,-19.085],[29.550,-19.060]]]}'), 4326)),

      -- Zone G: Southeast (Ripple Creek / toward Gweru, ~20 km SE)
      ('MC-KWE-008', 'Ripple Creek Gold',      'REG/2024/0301', 'Gold',     ${oid[0]}, 63.40,  'ACTIVE',   'Kwekwe', '2024-06-10', 'S. Moyo (SG)',      'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.850,-19.000],[29.870,-19.000],[29.870,-19.015],[29.850,-19.015],[29.850,-19.000]]]}'), 4326)),

      ('MC-KWE-013', 'Lower Gweru Tantalite',  'REG/2022/0488', 'Tantalite', ${oid[1]}, 158.00, 'ACTIVE',   'Kwekwe', '2022-09-05', 'R. Nkomo (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.880,-19.020],[29.905,-19.020],[29.905,-19.038],[29.880,-19.038],[29.880,-19.020]]]}'), 4326)),

      -- Zone H: Far South (Ngezi, ~25 km S) — mine surveyed 10 yrs after farm
      ('MC-KWE-016', 'Ngezi Gold Prospect',    'REG/2023/0940', 'Gold',     ${oid[2]}, 185.00, 'DISPUTED', 'Kwekwe', '2023-07-14', 'J. Mapuranga (SG)', 'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.780,-19.120],[29.810,-19.120],[29.810,-19.145],[29.780,-19.145],[29.780,-19.120]]]}'), 4326)),

      -- Zone I: Mine to Mine Intersects — rural bush ~25 km S of Kwekwe (no roads)
      ('MC-KWE-100', 'Alpha Gold Claim',       'REG/2024/0901', 'Gold',     ${oid[0]}, 50.00,  'DISPUTED', 'Kwekwe', '2024-01-01', 'S. Moyo (SG)',      'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.680,-19.160],[29.700,-19.160],[29.700,-19.180],[29.680,-19.180],[29.680,-19.160]]]}'), 4326)),

      ('MC-KWE-101', 'Beta Gold Prospect',     'REG/2024/0902', 'Gold',     ${oid[1]}, 50.00,  'DISPUTED', 'Kwekwe', '2024-02-01', 'T. Chigumba (SG)',  'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.690,-19.170],[29.710,-19.170],[29.710,-19.190],[29.690,-19.190],[29.690,-19.170]]]}'), 4326))
  `)

  // ─── Farm Parcels (rural areas surrounding Kwekwe) ─────────────
  await pool.query(`
    INSERT INTO spatial_data_farmparcel
      (parcel_code, farm_name, deed_no, lease_type, owner_id, land_use, area, survey_date, surveyor, coordinate_system, geom)
    VALUES
      -- Zone B: East — overlaps MC-KWE-002
      ('FP-KWE-001', 'Doongwai Farm',     'DEED/2020/KWE/001', 'Title Deed',   ${oid[2]}, 'Mixed farming',    450.00, '2020-05-12', 'P. Banda (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.860,-18.855],[29.895,-18.855],[29.895,-18.880],[29.860,-18.880],[29.860,-18.855]]]}'), 4326)),

      -- Zone G: Southeast
      ('FP-KWE-002', 'Sherwood Farm',     'DEED/2019/KWE/045', 'Title Deed',   ${oid[3]}, 'Cattle ranching',  820.00, '2019-09-30', 'J. Mapuranga (SG)', 'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.840,-18.990],[29.875,-18.990],[29.875,-19.020],[29.840,-19.020],[29.840,-18.990]]]}'), 4326)),

      ('FP-KWE-003', 'Sebakwe Ranch',     'OL/2021/KWE/012',   'Offer Letter', ${oid[3]}, 'Cattle ranching',  600.00, '2021-02-18', 'T. Chigumba (SG)', 'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.820,-19.010],[29.850,-19.010],[29.850,-19.030],[29.820,-19.030],[29.820,-19.010]]]}'), 4326)),

      -- Zone E: Southwest — overlaps MC-KWE-007
      ('FP-KWE-004', 'Patchway Estate',   'DEED/2018/KWE/078', 'Title Deed',   ${oid[5]}, 'Tobacco & maize',  520.00, '2018-11-15', 'P. Banda (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.695,-18.975],[29.730,-18.975],[29.730,-19.000],[29.695,-19.000],[29.695,-18.975]]]}'), 4326)),

      -- Zone B: East — overlaps MC-KWE-006
      ('FP-KWE-005', 'Munyati Irrigation','OL/2023/KWE/021',   'Offer Letter', ${oid[4]}, 'Irrigated crops',  280.00, '2023-03-20', 'S. Moyo (SG)',      'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.920,-18.865],[29.950,-18.865],[29.950,-18.890],[29.920,-18.890],[29.920,-18.865]]]}'), 4326)),

      -- Zone C: Northeast — overlaps MC-KWE-009
      ('FP-KWE-006', 'Kadoma Estates',    'DEED/2021/KWE/092', 'Title Deed',   ${oid[1]}, 'Mixed farming',    380.00, '2021-06-10', 'P. Banda (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.955,-18.805],[29.990,-18.805],[29.990,-18.828],[29.955,-18.828],[29.955,-18.805]]]}'), 4326)),

      -- Zone D: West — overlaps MC-KWE-010
      ('FP-KWE-007', 'Zhombe Grazing',    'OL/2022/KWE/035',   'Offer Letter', ${oid[5]}, 'Cattle ranching',  710.00, '2022-04-25', 'R. Nkomo (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.570,-18.912],[29.620,-18.912],[29.620,-18.950],[29.570,-18.950],[29.570,-18.912]]]}'), 4326)),

      -- Zone F: Far Southwest — overlaps MC-KWE-011
      ('FP-KWE-008', 'Silobela Farmlands','LEASE/2023/KWE/018','Lease',        ${oid[0]}, 'Crop farming',     430.00, '2023-08-15', 'S. Moyo (SG)',      'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.540,-19.050],[29.590,-19.050],[29.590,-19.090],[29.540,-19.090],[29.540,-19.050]]]}'), 4326)),

      -- Zone H: Far South — large farm surveyed 2013, MC-KWE-016 encroached 2023
      ('FP-KWE-009', 'Ngezi Valley Estate','DEED/2013/KWE/022','Title Deed',   ${oid[3]}, 'Cattle & crops', 1250.00, '2013-05-20', 'P. Banda (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.770,-19.100],[29.820,-19.100],[29.820,-19.150],[29.770,-19.150],[29.770,-19.100]]]}'), 4326)),

      -- Zone C: NE — large farm overlapping MC-KWE-003 (Indarama) and MC-KWE-005 (Zim Alloys)
      ('FP-KWE-010', 'Kwekwe North Farm', 'DEED/2015/KWE/031', 'Title Deed',   ${oid[2]}, 'Mixed farming',  950.00, '2015-03-10', 'P. Banda (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.870,-18.800],[29.950,-18.800],[29.950,-18.850],[29.870,-18.850],[29.870,-18.800]]]}'), 4326)),

      -- Zone J: Standalone Farms (No overlapping mines)
      ('FP-KWE-100', 'Gothic Farmlands',  'DEED/2012/KWE/101', 'Title Deed',   ${oid[3]}, 'Mixed farming',  500.00, '2012-05-10', 'P. Banda (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.600,-18.700],[29.650,-18.700],[29.650,-18.750],[29.600,-18.750],[29.600,-18.700]]]}'), 4326)),

      ('FP-KWE-101', 'Serengeti Acres',   'OL/2018/KWE/102',   'Offer Letter', ${oid[4]}, 'Cattle ranching',700.00, '2018-09-12', 'S. Moyo (SG)',      'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.900,-18.700],[29.950,-18.700],[29.950,-18.750],[29.900,-18.750],[29.900,-18.700]]]}'), 4326)),

      ('FP-KWE-102', 'Oasis Greens',      'DEED/2020/KWE/103', 'Title Deed',   ${oid[5]}, 'Crop farming',   400.00, '2020-11-20', 'R. Nkomo (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.500,-18.600],[29.550,-18.600],[29.550,-18.650],[29.500,-18.650],[29.500,-18.600]]]}'), 4326))
  `)

  // ─── Disputes — genuinely overlapping mine↔farm geometries ─────
  // 1. MC-KWE-006 (Munyati Gold Reef) ↔ FP-KWE-005 (Munyati Irrigation)
  //    Mine: 29.930–29.948, -18.870→-18.888 | Farm: 29.920–29.950, -18.865→-18.890
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 42.50, 'OPEN', '2024-05-15',
      ST_Intersection(mc.geom, fp.geom)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-006' AND fp.parcel_code = 'FP-KWE-005'
  `)

  // 2. MC-KWE-007 (Patchway Nickel) ↔ FP-KWE-004 (Patchway Estate)
  //    Mine: 29.700–29.722, -18.980→-18.998 | Farm: 29.695–29.730, -18.975→-19.000
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, resolved_at, geom)
    SELECT mc.id, fp.id, 28.10, 'RESOLVED', '2023-12-01', '2024-03-15',
      ST_Intersection(mc.geom, fp.geom)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-007' AND fp.parcel_code = 'FP-KWE-004'
  `)

  // 3. MC-KWE-009 (Kadoma Gold Extension) ↔ FP-KWE-006 (Kadoma Estates)
  //    Mine: 29.960–29.985, -18.810→-18.830 | Farm: 29.955–29.990, -18.805→-18.828
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 55.30, 'OPEN', '2024-08-20',
      ST_Intersection(mc.geom, fp.geom)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-009' AND fp.parcel_code = 'FP-KWE-006'
  `)

  // 4. MC-KWE-010 (Zhombe Chrome) ↔ FP-KWE-007 (Zhombe Grazing)
  //    Mine: 29.580–29.610, -18.920→-18.945 | Farm: 29.570–29.620, -18.912→-18.950
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 38.70, 'OPEN', '2024-09-28',
      ST_Intersection(mc.geom, fp.geom)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-010' AND fp.parcel_code = 'FP-KWE-007'
  `)

  // 5. MC-KWE-011 (Silobela Lithium) ↔ FP-KWE-008 (Silobela Farmlands)
  //    Mine: 29.550–29.580, -19.060→-19.085 | Farm: 29.540–29.590, -19.050→-19.090
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 72.40, 'OPEN', '2024-11-05',
      ST_Intersection(mc.geom, fp.geom)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-011' AND fp.parcel_code = 'FP-KWE-008'
  `)

  // 6. MC-KWE-016 (Ngezi Gold 2023) ↔ FP-KWE-009 (Ngezi Valley 2013) — 10 yr encroachment
  //    Mine: 29.780–29.810, -19.120→-19.145 | Farm: 29.770–29.820, -19.100→-19.150
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 185.00, 'OPEN', '2023-08-01',
      ST_Intersection(mc.geom, fp.geom)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-016' AND fp.parcel_code = 'FP-KWE-009'
  `)

  // 7. MC-KWE-003 (Indarama Chrome 210ha) ↔ FP-KWE-010 (Kwekwe North Farm)
  //    Mine: 29.880–29.905, -18.810→-18.830 | Farm: 29.870–29.950, -18.800→-18.850
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 32.50, 'OPEN', '2024-02-10',
      ST_Intersection(mc.geom, fp.geom)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-003' AND fp.parcel_code = 'FP-KWE-010'
  `)

  // 8. MC-KWE-005 (Zim Alloys 340ha) ↔ FP-KWE-010 (Kwekwe North Farm)
  //    Mine: 29.870–29.900, -18.825→-18.852 | Farm: 29.870–29.950, -18.800→-18.850
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 48.80, 'OPEN', '2024-05-01',
      ST_Intersection(mc.geom, fp.geom)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-005' AND fp.parcel_code = 'FP-KWE-010'
  `)

  // 9. MC-KWE-002 (Doris Gold) ↔ FP-KWE-001 (Doongwai Farm)
  //    Mine: 29.870–29.888, -18.860→-18.875 | Farm: 29.860–29.895, -18.855→-18.880
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 8.50, 'OPEN', '2024-09-10',
      ST_Intersection(mc.geom, fp.geom)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-002' AND fp.parcel_code = 'FP-KWE-001'
  `)

  // ─── Mine-to-Mine Disputes ─────────────────────────────────────
  // MC-KWE-100 (Alpha Gold) ↔ MC-KWE-101 (Beta Gold) — overlapping in rural bush
  await pool.query(`
    INSERT INTO disputes_mine_mine (mine_claim_a_id, mine_claim_b_id, conflict_area, status, detected_at, geom)
    SELECT a.id, b.id, 12.50, 'OPEN', '2024-03-15',
      ST_Intersection(a.geom, b.geom)
    FROM spatial_data_mineclaim a, spatial_data_mineclaim b
    WHERE a.claim_code = 'MC-KWE-100' AND b.claim_code = 'MC-KWE-101'
  `)

  console.log('✅ Kwekwe sample data seeded: 7 owners, 17 mine claims, 13 farm parcels, 9 mine↔farm disputes, 1 mine↔mine dispute')
}

async function migrate() {
  console.log('Running migrations...')
  await ensureNodeUsersTable()
  await pool.query(CREATE_ALL)
  await seedAdmin()
  await seedKwekweData()
  console.log('✅ All tables, indexes, and seed data ready.')
  await pool.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
