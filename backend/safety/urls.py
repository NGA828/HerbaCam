from django.urls import path
from .views import SafetyListView, SafetyDetailView, SafetyCreateView, SafetyUpdateView

urlpatterns = [
    path('', SafetyListView.as_view(), name='safety-list'),
    path('create/', SafetyCreateView.as_view(), name='safety-create'),
    path('<int:pk>/', SafetyDetailView.as_view(), name='safety-detail'),
    path('<int:pk>/update/', SafetyUpdateView.as_view(), name='safety-update'),
]
