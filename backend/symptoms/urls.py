from django.urls import path
from .views import (
    SymptomListView, SymptomDetailView, SymptomSearchView,
    SymptomAdminListView, SymptomAdminDetailView,
)

urlpatterns = [
    path('', SymptomListView.as_view(), name='symptom-list'),
    path('search/', SymptomSearchView.as_view(), name='symptom-search'),
    path('admin/', SymptomAdminListView.as_view(), name='symptom-admin-list'),
    path('admin/<int:pk>/', SymptomAdminDetailView.as_view(), name='symptom-admin-detail'),
    path('<int:pk>/', SymptomDetailView.as_view(), name='symptom-detail'),
]
