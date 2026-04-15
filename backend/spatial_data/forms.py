from django import forms

class GISUploadForm(forms.Form):
    file = forms.FileField(label="Upload GIS File (GeoJSON, KML, or ZIP Shapefile)")
    model_type = forms.ChoiceField(choices=[('MineClaim', 'Mine Claim'), ('FarmParcel', 'Farm Parcel')], required=True)
