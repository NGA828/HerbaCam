from django.urls import path

from .views import (
    AskView,
    ChatSessionArchive,
    ChatSessionDetail,
    ChatSessionListCreate,
    ChatSessionMessages,
)

urlpatterns = [
    path('', ChatSessionListCreate.as_view(), name='chat-session-list'),
    path('ask/', AskView.as_view(), name='chat-ask'),
    path('<int:pk>/', ChatSessionDetail.as_view(), name='chat-session-detail'),
    path('<int:pk>/messages/', ChatSessionMessages.as_view(), name='chat-session-messages'),
    path('<int:pk>/archive/', ChatSessionArchive.as_view(), name='chat-session-archive'),
]
