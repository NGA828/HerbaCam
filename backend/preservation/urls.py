from django.urls import path
from .views import RiskAssessmentListView, RiskAssessmentDetailView, RunRiskAssessmentView

urlpatterns = [
    path('risk/', RiskAssessmentListView.as_view(), name='risk-list'),
    path('risk/<int:pk>/', RiskAssessmentDetailView.as_view(), name='risk-detail'),
    path('risk/calculate/', RunRiskAssessmentView.as_view(), name='risk-calculate'),
]
