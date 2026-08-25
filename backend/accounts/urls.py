from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, ProfileView, ChangePasswordView, UserListView, UserManageView, SystemSettingsView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('settings/', SystemSettingsView.as_view(), name='system-settings'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', UserManageView.as_view(), name='user-manage'),
]
