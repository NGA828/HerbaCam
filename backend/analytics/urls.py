from django.urls import path
from .views import (
    FavoriteListView, FavoriteCreateView, FavoriteDeleteView,
    FavoriteCheckView, AnalyticsDashboardView
)

urlpatterns = [
    path('favorites/', FavoriteListView.as_view(), name='favorite-list'),
    path('favorites/add/', FavoriteCreateView.as_view(), name='favorite-add'),
    path('favorites/remove/', FavoriteDeleteView.as_view(), name='favorite-remove'),
    path('favorites/check/<int:plant_id>/', FavoriteCheckView.as_view(), name='favorite-check'),
    path('dashboard/', AnalyticsDashboardView.as_view(), name='analytics-dashboard'),
]
