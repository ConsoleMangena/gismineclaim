from django.urls import path
from .views import (
    DisputeReportCSVView,
    MineClaimsReportCSVView,
    FarmParcelsReportCSVView,
    SummaryReportView,
)

urlpatterns = [
    path('summary/', SummaryReportView.as_view(), name='report-summary'),
    path('disputes/csv/', DisputeReportCSVView.as_view(), name='report-disputes-csv'),
    path('mine-claims/csv/', MineClaimsReportCSVView.as_view(), name='report-mine-claims-csv'),
    path('farm-parcels/csv/', FarmParcelsReportCSVView.as_view(), name='report-farm-parcels-csv'),
]
