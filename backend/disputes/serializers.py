from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import Dispute, Hotspot


class DisputeSerializer(GeoFeatureModelSerializer):
    mine_claim_code = serializers.CharField(source='mine_claim.claim_code', read_only=True)
    farm_parcel_code = serializers.CharField(source='farm_parcel.parcel_code', read_only=True)

    class Meta:
        model = Dispute
        geo_field = 'geom'
        fields = [
            'id', 'mine_claim', 'farm_parcel', 'mine_claim_code',
            'farm_parcel_code', 'conflict_area', 'status',
            'detected_at', 'resolved_at',
        ]
        read_only_fields = ['detected_at']


class DisputeListSerializer(serializers.ModelSerializer):
    mine_claim_code = serializers.CharField(source='mine_claim.claim_code', read_only=True)
    farm_parcel_code = serializers.CharField(source='farm_parcel.parcel_code', read_only=True)

    class Meta:
        model = Dispute
        fields = [
            'id', 'mine_claim', 'farm_parcel', 'mine_claim_code',
            'farm_parcel_code', 'conflict_area', 'status',
            'detected_at', 'resolved_at',
        ]


class HotspotSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Hotspot
        geo_field = 'geom'
        fields = ['id', 'intensity', 'dispute_count', 'created_at']
