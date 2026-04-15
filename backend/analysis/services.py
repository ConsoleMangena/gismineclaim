from django.contrib.gis.db.models.functions import Area, Intersection
from django.contrib.gis.measure import D
from django.contrib.gis.geos import GEOSGeometry
from django.db import connection
from spatial_data.models import MineClaim, FarmParcel
from disputes.models import Dispute, Hotspot


def run_conflict_detection():
    """
    Detect spatial conflicts (overlaps) between mine claims and farm parcels.
    Uses ST_Intersects via GeoDjango ORM.
    Returns the number of new disputes created.
    """
    created = 0
    claims = MineClaim.objects.filter(status__in=['ACTIVE', 'DISPUTED'])

    for claim in claims:
        overlapping_parcels = FarmParcel.objects.filter(
            geom__intersects=claim.geom
        )
        for parcel in overlapping_parcels:
            overlap_geom = claim.geom.intersection(parcel.geom)

            dispute, was_created = Dispute.objects.get_or_create(
                mine_claim=claim,
                farm_parcel=parcel,
                defaults={
                    'geom': overlap_geom,
                    'status': 'OPEN',
                },
            )
            if was_created:
                created += 1

    return created


def run_buffer_analysis(threshold_meters=500):
    """
    Detect mine claims within a given distance of farm parcels (proximity risk).
    Uses ST_DWithin via GeoDjango ORM.
    Returns list of at-risk claim/parcel pairs that don't already overlap.
    """
    risks = []
    claims = MineClaim.objects.filter(status__in=['ACTIVE', 'DISPUTED'])

    for claim in claims:
        nearby_parcels = FarmParcel.objects.filter(
            geom__distance_lte=(claim.geom, D(m=threshold_meters))
        ).exclude(
            geom__intersects=claim.geom
        )
        for parcel in nearby_parcels:
            risks.append({
                'mine_claim': claim.claim_code,
                'farm_parcel': parcel.parcel_code,
                'status': 'proximity_risk',
            })

    return risks


def run_hotspot_analysis(grid_size=0.01):
    """
    Basic hotspot detection: group disputes by snapped grid location,
    count frequency, and store as Hotspot records.
    Uses raw SQL with PostGIS ST_SnapToGrid.
    """
    Hotspot.objects.all().delete()

    sql = """
        INSERT INTO disputes_hotspot (intensity, dispute_count, geom, created_at)
        SELECT
            COUNT(*)::float AS intensity,
            COUNT(*)::int AS dispute_count,
            ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
                ST_SnapToGrid(ST_Centroid(geom), %s),
                ST_Translate(ST_SnapToGrid(ST_Centroid(geom), %s), %s, 0),
                ST_Translate(ST_SnapToGrid(ST_Centroid(geom), %s), %s, %s),
                ST_Translate(ST_SnapToGrid(ST_Centroid(geom), %s), 0, %s),
                ST_SnapToGrid(ST_Centroid(geom), %s)
            ])), 4326) AS geom,
            NOW() AS created_at
        FROM disputes_dispute
        WHERE geom IS NOT NULL
        GROUP BY ST_SnapToGrid(ST_Centroid(geom), %s)
        HAVING COUNT(*) > 1
    """
    params = [
        grid_size, grid_size, grid_size,
        grid_size, grid_size, grid_size,
        grid_size, grid_size, grid_size,
        grid_size,
    ]

    with connection.cursor() as cursor:
        cursor.execute(sql, params)

    return Hotspot.objects.count()
