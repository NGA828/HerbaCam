from django.urls import path
from .views import (
    CommunityListView,
    DivisionListView,
    LocateView,
    RegionDetailView,
    RegionListView,
)

urlpatterns = [
    path('regions/', RegionListView.as_view(), name='region-list'),
    path('regions/<int:pk>/', RegionDetailView.as_view(), name='region-detail'),
    path('divisions/', DivisionListView.as_view(), name='division-list'),
    path('communities/', CommunityListView.as_view(), name='community-list'),
    path('locate/', LocateView.as_view(), name='locate'),
]
