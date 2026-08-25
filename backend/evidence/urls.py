from django.urls import path
from .views import EvidenceListView, EvidenceDetailView, EvidenceCreateView, EvidenceUpdateView

urlpatterns = [
    path('', EvidenceListView.as_view(), name='evidence-list'),
    path('create/', EvidenceCreateView.as_view(), name='evidence-create'),
    path('<int:pk>/', EvidenceDetailView.as_view(), name='evidence-detail'),
    path('<int:pk>/update/', EvidenceUpdateView.as_view(), name='evidence-update'),
]
