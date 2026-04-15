from django.shortcuts import render, redirect
from django.contrib.admin.views.decorators import staff_member_required
from .forms import GISUploadForm
import tempfile
import zipfile
import os
import uuid
from django.contrib.gis.gdal import DataSource, SpatialReference, CoordTransform
from django.contrib.gis.geos import GEOSGeometry, Polygon, MultiPolygon
from .models import MineClaim, FarmParcel, Owner, Boundary
from django.contrib import messages

@staff_member_required
def upload_gis_file(request):
    if request.method == 'POST':
        form = GISUploadForm(request.POST, request.FILES)
        if form.is_valid():
            uploaded_file = form.cleaned_data['file']
            model_type = form.cleaned_data['model_type']
            
            # Save file temporarily
            with tempfile.TemporaryDirectory() as tmpdir:
                file_path = os.path.join(tmpdir, uploaded_file.name)
                with open(file_path, 'wb+') as dest:
                    for chunk in uploaded_file.chunks():
                        dest.write(chunk)
                
                ext = os.path.splitext(uploaded_file.name)[1].lower()
                source_path = file_path
                
                if ext == '.zip':
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        zip_ref.extractall(tmpdir)
                    for f in os.listdir(tmpdir):
                        if f.endswith('.shp'):
                            source_path = os.path.join(tmpdir, f)
                            break
                            
                try:
                    ds = DataSource(source_path)
                    layer = ds[0]
                    # We usually want 4326 for GeoDjango PolygonField by default
                    
                    default_owner, _ = Owner.objects.get_or_create(
                        name="GIS Bulk Import", 
                        defaults={'national_id': f"IMPORT-{uuid.uuid4().hex[:8]}"}
                    )
                    
                    count = 0
                    for feat in layer:
                        geom = feat.geom
                        
                        # Handle CRS transformation
                        if layer.srs:
                            target_srs = SpatialReference(4326)
                            transform = CoordTransform(layer.srs, target_srs)
                            geom.transform(transform)
                            
                        geos_geom = geom.geos
                        if isinstance(geos_geom, MultiPolygon):
                            # The models use PolygonField. We must take the largest polygon or first
                            # if it's a multipolygon, or change the model to MultiPolygonField.
                            # Models use PolygonField(srid=4326)
                            geos_geom = geos_geom[0]
                            
                        area_ha = geos_geom.area * 10000  # rough estimate if degree -> ha, better to use proper projection but keeping simple
                        code = str(uuid.uuid4())[:8]
                        
                        if model_type == 'MineClaim':
                            MineClaim.objects.create(
                                claim_code=f"IMP-MC-{code}",
                                owner=default_owner,
                                area=area_ha,
                                geom=geos_geom,
                                status='ACTIVE'
                            )
                        else:
                            FarmParcel.objects.create(
                                parcel_code=f"IMP-FP-{code}",
                                owner=default_owner,
                                area=area_ha,
                                geom=geos_geom,
                                land_use='Farming'
                            )
                        count += 1
                        
                    messages.success(request, f"Successfully imported {count} {model_type} records.")
                    return redirect('admin:index')
                    
                except Exception as e:
                    messages.error(request, f"Error processing GIS file: {str(e)}")
                    return redirect('admin:index')

    else:
        form = GISUploadForm()
        
    return render(request, 'admin/gis_upload.html', {'form': form, 'opts': {'app_label': 'spatial_data'}})

from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from .serializers import OwnerSerializer, MineClaimSerializer, FarmParcelSerializer, BoundarySerializer

class OwnerViewSet(viewsets.ModelViewSet):
    queryset = Owner.objects.all()
    serializer_class = OwnerSerializer
    filter_backends = [DjangoFilterBackend]

class MineClaimViewSet(viewsets.ModelViewSet):
    queryset = MineClaim.objects.all()
    serializer_class = MineClaimSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']
    search_fields = ['claim_code', 'owner__name']

class FarmParcelViewSet(viewsets.ModelViewSet):
    queryset = FarmParcel.objects.all()
    serializer_class = FarmParcelSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['land_use']
    search_fields = ['parcel_code', 'owner__name']

class BoundaryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Boundary.objects.all()
    serializer_class = BoundarySerializer
