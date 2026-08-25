from django.urls import path
from .views import PractitionerProfileView, PractitionerListView

urlpatterns = [
    path('profile/', PractitionerProfileView.as_view(), name='practitioner-profile'),
    path('list/', PractitionerListView.as_view(), name='practitioner-list'),
]
