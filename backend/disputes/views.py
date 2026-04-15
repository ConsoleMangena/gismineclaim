from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from .models import Dispute, Hotspot
from .serializers import DisputeSerializer, DisputeListSerializer, HotspotSerializer


class DisputeViewSet(viewsets.ModelViewSet):
    queryset = Dispute.objects.select_related('mine_claim', 'farm_parcel').all()
    serializer_class = DisputeSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']
    search_fields = ['mine_claim__claim_code', 'farm_parcel__parcel_code']

    def get_serializer_class(self):
        if self.action == 'list':
            return DisputeListSerializer
        return DisputeSerializer


class HotspotViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Hotspot.objects.all()
    serializer_class = HotspotSerializer
