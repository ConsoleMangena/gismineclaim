from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/', include('spatial_data.urls')),
    path('api/', include('disputes.urls')),
    path('api/analysis/', include('analysis.urls')),
    path('api/reports/', include('reports.urls')),
]
