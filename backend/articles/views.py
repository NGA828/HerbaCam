from django.utils import timezone
from rest_framework import generics, permissions
from .models import Article, ArticleCategory
from .serializers import ArticleListSerializer, ArticleDetailSerializer, ArticleCategorySerializer


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and (request.user.is_admin_role or request.user.is_superuser)


class ArticleListView(generics.ListAPIView):
    """List published articles."""
    serializer_class = ArticleListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Article.objects.select_related('author', 'category')
        user = self.request.user
        if not (user.is_authenticated and (user.is_admin_role or user.is_superuser)):
            qs = qs.filter(is_published=True)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__slug=category)
        return qs


class ArticleDetailView(generics.RetrieveAPIView):
    serializer_class = ArticleDetailSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = self.request.user
        qs = Article.objects.select_related('author', 'category')
        if not (user.is_authenticated and (user.is_admin_role or user.is_superuser)):
            qs = qs.filter(is_published=True)
        return qs


class ArticleAdminListView(generics.ListCreateAPIView):
    serializer_class = ArticleDetailSerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = Article.objects.all()

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class ArticleAdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ArticleDetailSerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = Article.objects.all()

    def perform_update(self, serializer):
        article = serializer.save()
        if article.is_published and not article.published_at:
            article.published_at = timezone.now()
            article.save()


class ArticleCategoryListView(generics.ListAPIView):
    serializer_class = ArticleCategorySerializer
    queryset = ArticleCategory.objects.all()
    permission_classes = [permissions.AllowAny]
