from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import Owner, MineClaim, FarmParcel, Boundary


class OwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Owner
        fields = ['id', 'name', 'national_id', 'contact_info', 'created_at']
        read_only_fields = ['created_at']


class MineClaimSerializer(GeoFeatureModelSerializer):
    owner_name = serializers.CharField(source='owner.name', read_only=True)

    class Meta:
        model = MineClaim
        geo_field = 'geom'
        fields = ['id', 'claim_code', 'owner', 'owner_name', 'area', 'status', 'created_at']
        read_only_fields = ['created_at']


class FarmParcelSerializer(GeoFeatureModelSerializer):
    owner_name = serializers.CharField(source='owner.name', read_only=True)

    class Meta:
        model = FarmParcel
        geo_field = 'geom'
        fields = ['id', 'parcel_code', 'owner', 'owner_name', 'land_use', 'area', 'created_at']
        read_only_fields = ['created_at']


class BoundarySerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Boundary
        geo_field = 'geom'
        fields = ['id', 'name', 'boundary_type']
