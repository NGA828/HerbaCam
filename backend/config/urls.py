"""URL configuration for HerbaCam."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    return Response({
        'name': 'HerbaCam API',
        'description': 'AI-Powered Web Application for Identification, Recommendation, and Preservation of Cameroonian Traditional Medicinal Plant Knowledge',
        'version': '1.0.0',
        'endpoints': {
            'auth': '/api/auth/',
            'plants': '/api/plants/',
            'symptoms': '/api/symptoms/',
            'identification': '/api/identification/',
            'knowledge': '/api/knowledge/',
            'evidence': '/api/evidence/',
            'safety': '/api/safety/',
            'geography': '/api/geography/',
            'articles': '/api/articles/',
            'practitioners': '/api/practitioners/',
            'notifications': '/api/notifications/',
            'analytics': '/api/analytics/',
            'preservation': '/api/preservation/',
            'audit': '/api/audit/',
        }
    })


urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/plants/', include('plants.urls')),
    path('api/symptoms/', include('symptoms.urls')),
    path('api/identification/', include('identification.urls')),
    path('api/knowledge/', include('knowledge.urls')),
    path('api/evidence/', include('evidence.urls')),
    path('api/safety/', include('safety.urls')),
    path('api/geography/', include('geography.urls')),
    path('api/articles/', include('articles.urls')),
    path('api/practitioners/', include('practitioners.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/analytics/', include('analytics.urls')),
    path('api/preservation/', include('preservation.urls')),
    path('api/audit/', include('audit.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
