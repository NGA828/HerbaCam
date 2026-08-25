from django.urls import path
from .views import (
    PlantIdentifyView, IdentificationHistoryView,
    IdentificationDetailView, IdentificationDeleteView,
    ReportIdentificationView
)

urlpatterns = [
    path('identify/', PlantIdentifyView.as_view(), name='identify-plant'),
    path('history/', IdentificationHistoryView.as_view(), name='identification-history'),
    path('<int:pk>/', IdentificationDetailView.as_view(), name='identification-detail'),
    path('<int:pk>/delete/', IdentificationDeleteView.as_view(), name='identification-delete'),
    path('<int:pk>/report/', ReportIdentificationView.as_view(), name='identification-report'),
]
