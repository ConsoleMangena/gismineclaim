from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DisputeViewSet, HotspotViewSet

router = DefaultRouter()
router.register(r'disputes', DisputeViewSet, basename='dispute')
router.register(r'hotspots', HotspotViewSet, basename='hotspot')

urlpatterns = [
    path('', include(router.urls)),
]
