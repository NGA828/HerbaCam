from django.contrib import admin
from .models import Article, ArticleCategory
@admin.register(ArticleCategory)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']
@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'is_published', 'published_at']
    list_filter = ['is_published', 'category']
    prepopulated_fields = {'slug': ('title',)}
