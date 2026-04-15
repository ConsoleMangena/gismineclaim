from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from .models import Dispute, Hotspot

@admin.register(Dispute)
class DisputeAdmin(GISModelAdmin):
    list_display = ('id', 'mine_claim', 'farm_parcel', 'status', 'conflict_area', 'detected_at', 'resolved_at')
    search_fields = ('mine_claim__claim_code', 'farm_parcel__parcel_code')
    list_filter = ('status', 'detected_at')
    readonly_fields = ('detected_at',)
    ordering = ('-detected_at',)

@admin.register(Hotspot)
class HotspotAdmin(GISModelAdmin):
    list_display = ('id', 'intensity', 'dispute_count', 'created_at')
    list_filter = ('created_at',)
    readonly_fields = ('created_at',)
    ordering = ('-intensity',)
