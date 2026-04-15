from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from .models import Owner, MineClaim, FarmParcel, Boundary
from .views import upload_gis_file

class CustomAdminSite(admin.AdminSite):
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('upload-gis/', self.admin_view(upload_gis_file), name='upload-gis'),
        ]
        return custom_urls + urls

admin_site = CustomAdminSite()

# Register the models to the custom admin site as well, or just patch the default site urls
def get_admin_urls(urls):
    def get_urls():
        my_urls = [
            path('upload-gis/', admin.site.admin_view(upload_gis_file), name='upload-gis')
        ]
        return my_urls + urls
    return get_urls

admin.site.get_urls = get_admin_urls(admin.site.get_urls())

@admin.register(Owner)
class OwnerAdmin(admin.ModelAdmin):
    list_display = ('name', 'national_id', 'created_at')
    search_fields = ('name', 'national_id')
    ordering = ('-created_at',)

    def get_urls(self):
        urls = super().get_urls()
        from django.urls import path
        my_urls = [
            path('upload-gis/', admin.site.admin_view(upload_gis_file), name='upload-gis-mineclaim')
        ]
        return my_urls + urls

@admin.register(MineClaim)
class MineClaimAdmin(GISModelAdmin):
    list_display = ('claim_code', 'owner', 'status', 'area', 'created_at')
    search_fields = ('claim_code', 'owner__name')
    list_filter = ('status', 'created_at')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    change_list_template = "admin/mineclaim_changelist.html"

    def get_urls(self):
        urls = super().get_urls()
        from django.urls import path
        my_urls = [
            path('upload-gis/', admin.site.admin_view(upload_gis_file), name='upload-gis-mineclaim')
        ]
        return my_urls + urls

@admin.register(FarmParcel)
class FarmParcelAdmin(GISModelAdmin):
    list_display = ('parcel_code', 'owner', 'land_use', 'area', 'created_at')
    search_fields = ('parcel_code', 'owner__name')
    list_filter = ('land_use', 'created_at')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    change_list_template = "admin/farmparcel_changelist.html"

    def get_urls(self):
        urls = super().get_urls()
        from django.urls import path
        my_urls = [
            path('upload-gis/', admin.site.admin_view(upload_gis_file), name='upload-gis-farmparcel')
        ]
        return my_urls + urls

@admin.register(Boundary)
class BoundaryAdmin(GISModelAdmin):
    list_display = ('name', 'boundary_type')
    search_fields = ('name',)
    list_filter = ('boundary_type',)
    ordering = ('name',)
