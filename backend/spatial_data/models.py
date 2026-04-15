from django.contrib.gis.db import models


class Owner(models.Model):
    name = models.CharField(max_length=255)
    national_id = models.CharField(max_length=50, unique=True)
    contact_info = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class MineClaim(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('DISPUTED', 'Disputed'),
        ('EXPIRED', 'Expired'),
    ]

    claim_code = models.CharField(max_length=100, unique=True)
    owner = models.ForeignKey(Owner, on_delete=models.CASCADE, related_name='mine_claims')
    area = models.FloatField(help_text='Area in hectares')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    geom = models.PolygonField(srid=4326)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.claim_code} - {self.owner.name}"


class FarmParcel(models.Model):
    parcel_code = models.CharField(max_length=100, unique=True)
    owner = models.ForeignKey(Owner, on_delete=models.CASCADE, related_name='farm_parcels')
    land_use = models.CharField(max_length=100, blank=True)
    area = models.FloatField(help_text='Area in hectares', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    geom = models.PolygonField(srid=4326)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.parcel_code} - {self.owner.name}"


class Boundary(models.Model):
    BOUNDARY_TYPE_CHOICES = [
        ('DISTRICT', 'District'),
        ('PROVINCE', 'Province'),
    ]

    name = models.CharField(max_length=200)
    boundary_type = models.CharField(max_length=20, choices=BOUNDARY_TYPE_CHOICES)
    geom = models.MultiPolygonField(srid=4326)

    class Meta:
        ordering = ['boundary_type', 'name']
        verbose_name_plural = 'boundaries'

    def __str__(self):
        return f"{self.name} ({self.boundary_type})"
