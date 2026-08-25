from django.urls import path
from .views import (
    ArticleListView, ArticleDetailView,
    ArticleAdminListView, ArticleAdminDetailView,
    ArticleCategoryListView
)

urlpatterns = [
    path('', ArticleListView.as_view(), name='article-list'),
    path('categories/', ArticleCategoryListView.as_view(), name='article-category-list'),
    path('admin/', ArticleAdminListView.as_view(), name='article-admin-list'),
    path('admin/<int:pk>/', ArticleAdminDetailView.as_view(), name='article-admin-detail'),
    path('<slug:slug>/', ArticleDetailView.as_view(), name='article-detail'),
]
