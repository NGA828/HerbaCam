from django.urls import path
from .views import (
    KnowledgeSubmissionCreateView, KnowledgeSubmissionListView,
    KnowledgeSubmissionDetailView, PendingReviewListView,
    ReviewSubmissionView, TraditionalUseListView, PreparationMethodListView
)

urlpatterns = [
    path('submissions/', KnowledgeSubmissionListView.as_view(), name='submission-list'),
    path('submissions/create/', KnowledgeSubmissionCreateView.as_view(), name='submission-create'),
    path('submissions/<int:pk>/', KnowledgeSubmissionDetailView.as_view(), name='submission-detail'),
    path('submissions/pending/', PendingReviewListView.as_view(), name='submission-pending'),
    path('submissions/<int:pk>/review/', ReviewSubmissionView.as_view(), name='submission-review'),
    path('traditional-uses/', TraditionalUseListView.as_view(), name='traditional-use-list'),
    path('preparation-methods/', PreparationMethodListView.as_view(), name='preparation-method-list'),
]
