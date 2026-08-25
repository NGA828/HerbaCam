from django.contrib import admin
from .models import PractitionerProfile
@admin.register(PractitionerProfile)
class PractitionerAdmin(admin.ModelAdmin):
    list_display = ['user', 'region', 'years_of_experience', 'is_verified']
    list_filter = ['is_verified', 'region']
