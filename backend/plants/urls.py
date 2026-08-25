from django.urls import path
from .views import PlantListView, PlantDetailView, PlantAdminListView, PlantAdminDetailView, PlantSearchView

urlpatterns = [
    path('', PlantListView.as_view(), name='plant-list'),
    path('search/', PlantSearchView.as_view(), name='plant-search'),
    path('admin/', PlantAdminListView.as_view(), name='plant-admin-list'),
    path('admin/<int:pk>/', PlantAdminDetailView.as_view(), name='plant-admin-detail'),
    path('<int:pk>/', PlantDetailView.as_view(), name='plant-detail'),
]
