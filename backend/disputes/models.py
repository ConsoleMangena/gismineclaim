from django.contrib.gis.db import models
from spatial_data.models import MineClaim, FarmParcel


class Dispute(models.Model):
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('RESOLVED', 'Resolved'),
        ('PENDING', 'Pending'),
    ]

    mine_claim = models.ForeignKey(MineClaim, on_delete=models.CASCADE, related_name='disputes')
    farm_parcel = models.ForeignKey(FarmParcel, on_delete=models.CASCADE, related_name='disputes')
    conflict_area = models.FloatField(help_text='Overlap area in hectares', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    detected_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    geom = models.PolygonField(srid=4326, null=True, blank=True, help_text='Overlap geometry')

    class Meta:
        ordering = ['-detected_at']
        unique_together = ['mine_claim', 'farm_parcel']

    def __str__(self):
        return f"Dispute: {self.mine_claim.claim_code} ↔ {self.farm_parcel.parcel_code}"


class Hotspot(models.Model):
    intensity = models.FloatField(help_text='Hotspot intensity score')
    dispute_count = models.IntegerField(default=0)
    geom = models.PolygonField(srid=4326)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-intensity']

    def __str__(self):
        return f"Hotspot (intensity={self.intensity}, disputes={self.dispute_count})"
