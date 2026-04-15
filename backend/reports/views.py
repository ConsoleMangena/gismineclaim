import csv
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from disputes.models import Dispute, Hotspot
from spatial_data.models import MineClaim, FarmParcel


class DisputeReportCSVView(APIView):
    """GET /api/reports/disputes/csv/"""

    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="disputes_report.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Mine Claim', 'Farm Parcel', 'Conflict Area (ha)',
            'Status', 'Detected At', 'Resolved At',
        ])

        disputes = Dispute.objects.select_related('mine_claim', 'farm_parcel').all()
        for d in disputes:
            writer.writerow([
                d.id,
                d.mine_claim.claim_code,
                d.farm_parcel.parcel_code,
                d.conflict_area or '',
                d.status,
                d.detected_at.strftime('%Y-%m-%d %H:%M') if d.detected_at else '',
                d.resolved_at.strftime('%Y-%m-%d %H:%M') if d.resolved_at else '',
            ])

        return response


class MineClaimsReportCSVView(APIView):
    """GET /api/reports/mine-claims/csv/"""

    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="mine_claims_report.csv"'

        writer = csv.writer(response)
        writer.writerow(['ID', 'Claim Code', 'Owner', 'Area (ha)', 'Status', 'Created At'])

        claims = MineClaim.objects.select_related('owner').all()
        for c in claims:
            writer.writerow([
                c.id, c.claim_code, c.owner.name, c.area, c.status,
                c.created_at.strftime('%Y-%m-%d %H:%M'),
            ])

        return response


class FarmParcelsReportCSVView(APIView):
    """GET /api/reports/farm-parcels/csv/"""

    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="farm_parcels_report.csv"'

        writer = csv.writer(response)
        writer.writerow(['ID', 'Parcel Code', 'Owner', 'Land Use', 'Area (ha)', 'Created At'])

        parcels = FarmParcel.objects.select_related('owner').all()
        for p in parcels:
            writer.writerow([
                p.id, p.parcel_code, p.owner.name, p.land_use, p.area or '',
                p.created_at.strftime('%Y-%m-%d %H:%M'),
            ])

        return response


class SummaryReportView(APIView):
    """GET /api/reports/summary/"""

    def get(self, request):
        total_claims = MineClaim.objects.count()
        total_parcels = FarmParcel.objects.count()
        total_disputes = Dispute.objects.count()
        open_disputes = Dispute.objects.filter(status='OPEN').count()
        resolved_disputes = Dispute.objects.filter(status='RESOLVED').count()
        total_hotspots = Hotspot.objects.count()

        return Response({
            'total_mine_claims': total_claims,
            'total_farm_parcels': total_parcels,
            'total_disputes': total_disputes,
            'open_disputes': open_disputes,
            'resolved_disputes': resolved_disputes,
            'total_hotspots': total_hotspots,
        }, status=status.HTTP_200_OK)
