from django.urls import path

from .views import FeedbackCreate, FeedbackDetail, FeedbackList

urlpatterns = [
    path('', FeedbackList.as_view(), name='feedback-list'),
    path('send/', FeedbackCreate.as_view(), name='feedback-send'),
    path('<int:pk>/', FeedbackDetail.as_view(), name='feedback-detail'),
]
