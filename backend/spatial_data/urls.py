from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OwnerViewSet, MineClaimViewSet, FarmParcelViewSet, BoundaryViewSet

router = DefaultRouter()
router.register(r'owners', OwnerViewSet, basename='owner')
router.register(r'mine-claims', MineClaimViewSet, basename='mineclaim')
router.register(r'farm-parcels', FarmParcelViewSet, basename='farmparcel')
router.register(r'boundaries', BoundaryViewSet, basename='boundary')

urlpatterns = [
    path('', include(router.urls)),
]
