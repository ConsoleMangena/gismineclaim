import random
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Polygon, MultiPolygon
from faker import Faker

from users.models import User
from spatial_data.models import Owner, MineClaim, FarmParcel, Boundary
from disputes.models import Dispute, Hotspot

# Zimbabwe bounding box: lon 25.23–33.06, lat -22.42–-15.61
ZW_PROVINCES = [
    ("Mashonaland Central",  (30.5, -17.2, 32.0, -15.8)),
    ("Mashonaland East",    (31.0, -18.5, 32.8, -17.0)),
    ("Mashonaland West",    (26.5, -18.0, 30.0, -16.0)),
    ("Midlands",            (28.5, -20.5, 31.5, -18.0)),
    ("Matabeleland North",  (25.5, -20.0, 29.0, -17.5)),
    ("Matabeleland South",  (25.5, -22.2, 29.5, -20.0)),
    ("Masvingo",            (30.0, -22.0, 32.5, -19.5)),
    ("Manicaland",          (31.5, -20.5, 33.0, -17.5)),
    ("Bulawayo",            (28.3, -20.3, 28.9, -19.9)),
    ("Harare",              (31.0, -18.0, 31.5, -17.6)),
]

ZW_CITIES = [
    "Harare", "Bulawayo", "Chitungwiza", "Mutare", "Gweru",
    "Kwekwe", "Kadoma", "Masvingo", "Chinhoyi", "Norton",
    "Marondera", "Ruwa", "Chegutu", "Zvishavane", "Bindura",
    "Beitbridge", "Redcliff", "Victoria Falls", "Hwange", "Kariba",
]

ZW_COMPANIES = [
    "Zimplats Holdings", "Blanket Mine", "Freda Rebecca Gold Mine",
    "Vumbachikwe Mining", "Caledonia Mining Corp", "Mimosa Platinum",
    "Sandawana Mines", "Rio Tinto Zimbabwe", "ZimAlloys", "Falcon Gold",
    "Golden Quarry Mining", "Great Dyke Investments", "Murowa Diamonds",
    "Zimbabwe Consolidated Diamond", "Bindura Nickel Corporation",
    "Arcturus Mine", "Shamva Mining Centre", "How Mine Gold", "Patchway Farm",
    "Grasslands Tobacco Estate",
]

LAND_USES = ["Tobacco", "Maize", "Cattle ranching", "Subsistence farming",
             "Commercial farming", "Wildlife conservancy", "Horticulture", "Soya bean"]


class Command(BaseCommand):
    help = 'Seeds the database with Zimbabwean spatial and user data'

    def handle(self, *args, **kwargs):
        fake = Faker()

        self.stdout.write("🧹 Cleaning up existing dummy data...")
        Dispute.objects.all().delete()
        Hotspot.objects.all().delete()
        MineClaim.objects.all().delete()
        FarmParcel.objects.all().delete()
        Boundary.objects.all().delete()
        Owner.objects.all().delete()
        User.objects.filter(username__in=['admin', 'testuser']).delete()

        # ── Users ─────────────────────────────────────────────────────────────
        self.stdout.write("👤 Creating users...")
        User.objects.create_user(
            username='admin', email='admin@zimmineclaim.co.zw',
            password='Password123!', role='ADMIN',
            first_name='Tatenda', last_name='Moyo',
        )
        User.objects.create_user(
            username='testuser', email='user@zimmineclaim.co.zw',
            password='Password123!', role='USER',
            first_name='Chiedza', last_name='Nhamo',
        )

        # ── Boundaries (Provinces) ────────────────────────────────────────────
        self.stdout.write("🗺️  Creating Zimbabwean province boundaries...")
        for name, (x1, y1, x2, y2) in ZW_PROVINCES:
            poly = Polygon.from_bbox((x1, y1, x2, y2))
            Boundary.objects.create(
                name=name,
                boundary_type=random.choice(['PROVINCE', 'DISTRICT']),
                geom=MultiPolygon(poly),
            )

        # ── Owners ────────────────────────────────────────────────────────────
        self.stdout.write("🏢 Creating mine and farm owners...")
        owners = []
        shuffled_companies = ZW_COMPANIES.copy()
        random.shuffle(shuffled_companies)
        for i, company in enumerate(shuffled_companies):
            city = random.choice(ZW_CITIES)
            owner = Owner.objects.create(
                name=company,
                national_id=f"ZW{fake.numerify('########')}",
                contact_info=f"{fake.street_address()}, {city}, Zimbabwe",
            )
            owners.append(owner)

        # ── Farm Parcels ───────────────────────────────────────────────────────
        self.stdout.write("🌾 Creating Zimbabwean farm parcels...")
        farms = []
        for i in range(20):
            _, (x1, y1, x2, y2) = random.choice(ZW_PROVINCES)
            lon = random.uniform(x1, x2 - 0.4)
            lat = random.uniform(y1, y2 - 0.4)
            poly = Polygon.from_bbox((lon, lat, lon + 0.35, lat + 0.35))
            farm = FarmParcel.objects.create(
                parcel_code=f"ZW-FP-{fake.numerify('####')}",
                owner=random.choice(owners),
                land_use=random.choice(LAND_USES),
                area=round(random.uniform(100.0, 800.0), 2),
                geom=poly,
            )
            farms.append(farm)

        # ── Mine Claims (some overlapping farms) ──────────────────────────────
        self.stdout.write("⛏️  Creating mine claims (with overlaps)...")
        claims = []
        # First batch: intentional overlaps with farms
        for farm in farms[:10]:
            ext = farm.geom.extent  # (xmin, ymin, xmax, ymax)
            lon = ext[0] + 0.05
            lat = ext[1] + 0.05
            poly = Polygon.from_bbox((lon, lat, lon + 0.3, lat + 0.3))
            claim = MineClaim.objects.create(
                claim_code=f"ZW-MC-{fake.numerify('####')}",
                owner=random.choice(owners),
                status=random.choice(['ACTIVE', 'ACTIVE', 'DISPUTED']),
                area=round(random.uniform(50.0, 350.0), 2),
                geom=poly,
            )
            claims.append(claim)

        # Second batch: standalone claims
        for _ in range(12):
            _, (x1, y1, x2, y2) = random.choice(ZW_PROVINCES)
            lon = random.uniform(x1, x2 - 0.15)
            lat = random.uniform(y1, y2 - 0.15)
            poly = Polygon.from_bbox((lon, lat, lon + 0.12, lat + 0.12))
            claim = MineClaim.objects.create(
                claim_code=f"ZW-MC-{fake.numerify('####')}",
                owner=random.choice(owners),
                status=random.choice(['ACTIVE', 'EXPIRED']),
                area=round(random.uniform(30.0, 180.0), 2),
                geom=poly,
            )
            claims.append(claim)

        # ── Disputes ──────────────────────────────────────────────────────────
        self.stdout.write("⚠️  Generating disputes from overlapping geometries...")
        dispute_geoms = []
        created_pairs = set()
        for claim in claims:
            for farm in farms:
                pair = (claim.id, farm.id)
                if pair in created_pairs:
                    continue
                if claim.geom.intersects(farm.geom):
                    intersection = claim.geom.intersection(farm.geom)
                    if not intersection.empty and intersection.geom_type == 'Polygon':
                        d = Dispute.objects.create(
                            mine_claim=claim,
                            farm_parcel=farm,
                            status=random.choice(['OPEN', 'OPEN', 'PENDING', 'RESOLVED']),
                            conflict_area=round(intersection.area * 12321, 2),
                            geom=intersection,
                        )
                        dispute_geoms.append(d.geom)
                        created_pairs.add(pair)

        # ── Hotspots ──────────────────────────────────────────────────────────
        self.stdout.write("🔥 Creating conflict hotspots...")
        if dispute_geoms:
            for geom in dispute_geoms[:5]:
                Hotspot.objects.create(
                    intensity=round(random.uniform(0.55, 1.0), 3),
                    dispute_count=random.randint(1, 8),
                    geom=geom.convex_hull,
                )

        total_disputes = Dispute.objects.count()
        total_claims = MineClaim.objects.count()
        total_farms = FarmParcel.objects.count()

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Database seeded with Zimbabwean data!\n"
            f"   Users     : 2 (admin / testuser)\n"
            f"   Provinces : {Boundary.objects.count()}\n"
            f"   Owners    : {Owner.objects.count()}\n"
            f"   Mine Claims: {total_claims}\n"
            f"   Farms     : {total_farms}\n"
            f"   Disputes  : {total_disputes}\n"
            f"   Hotspots  : {Hotspot.objects.count()}"
        ))
