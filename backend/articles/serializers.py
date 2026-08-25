from rest_framework import serializers
from .models import Article, ArticleCategory


class ArticleCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleCategory
        fields = ['id', 'name', 'description', 'slug']


class ArticleListSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True, default='')

    class Meta:
        model = Article
        fields = ['id', 'title', 'slug', 'summary', 'cover_image',
                  'author_name', 'category_name', 'is_published', 'published_at', 'created_at']

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.get_full_name() or obj.author.username
        return 'HerbaCam Team'


class ArticleDetailSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    category = ArticleCategorySerializer(read_only=True)

    class Meta:
        model = Article
        fields = ['id', 'title', 'slug', 'content', 'summary', 'cover_image',
                  'author_name', 'category', 'is_published', 'published_at',
                  'created_at', 'updated_at']

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.get_full_name() or obj.author.username
        return 'HerbaCam Team'
