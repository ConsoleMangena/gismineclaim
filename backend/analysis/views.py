from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import run_conflict_detection, run_buffer_analysis, run_hotspot_analysis


class RunConflictDetectionView(APIView):
    """POST /api/analysis/run-conflict-detection/"""

    def post(self, request):
        count = run_conflict_detection()
        return Response(
            {'message': f'{count} new conflict(s) detected.', 'new_disputes': count},
            status=status.HTTP_200_OK,
        )


class RunBufferAnalysisView(APIView):
    """GET /api/analysis/buffer-risks/?threshold=500"""

    def get(self, request):
        threshold = int(request.query_params.get('threshold', 500))
        risks = run_buffer_analysis(threshold_meters=threshold)
        return Response(risks, status=status.HTTP_200_OK)


class RunHotspotAnalysisView(APIView):
    """POST /api/analysis/run-hotspot-analysis/"""

    def post(self, request):
        grid_size = float(request.query_params.get('grid_size', 0.01))
        count = run_hotspot_analysis(grid_size=grid_size)
        return Response(
            {'message': f'{count} hotspot(s) identified.', 'hotspots': count},
            status=status.HTTP_200_OK,
        )
