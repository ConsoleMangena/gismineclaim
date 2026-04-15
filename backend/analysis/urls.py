from django.urls import path
from .views import RunConflictDetectionView, RunBufferAnalysisView, RunHotspotAnalysisView

urlpatterns = [
    path('run-conflict-detection/', RunConflictDetectionView.as_view(), name='run-conflict-detection'),
    path('buffer-risks/', RunBufferAnalysisView.as_view(), name='buffer-risks'),
    path('run-hotspot-analysis/', RunHotspotAnalysisView.as_view(), name='run-hotspot-analysis'),
]
