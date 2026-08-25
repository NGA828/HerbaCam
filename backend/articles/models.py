from django.db import models
from django.conf import settings


class ArticleCategory(models.Model):
    """Category for educational articles."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default='')
    slug = models.SlugField(unique=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'article categories'

    def __str__(self):
        return self.name


class Article(models.Model):
    """Educational articles about traditional medicine, plants, etc."""
    title = models.CharField(max_length=500)
    slug = models.SlugField(unique=True)
    content = models.TextField()
    summary = models.TextField(blank=True, default='')
    category = models.ForeignKey(ArticleCategory, on_delete=models.SET_NULL,
                                  null=True, blank=True, related_name='articles')
    cover_image = models.ImageField(upload_to='articles/', blank=True, null=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                null=True, related_name='articles')
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-published_at', '-created_at']

    def __str__(self):
        return self.title
