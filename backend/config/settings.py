"""
Django settings for HerbaCam project.
"""
import os
import re
import urllib.parse
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

# Allow MySQL to work via the pure-Python PyMySQL driver if mysqlclient is not installed.
# mysqlclient is the preferred driver in production; PyMySQL is a fallback for Windows/common dev machines.
if os.getenv('DB_ENGINE', '').lower() == 'mysql' or os.getenv('DB_HOST') or os.getenv('DATABASE_URL'):
    try:
        import MySQLdb  # noqa: F401
    except ImportError:
        try:
            import pymysql
            pymysql.install_as_MySQLdb()
        except ImportError:
            pass

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-dev-key-change-in-production')
DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'

ALLOWED_HOSTS = ['*']
CORS_ALLOW_ALL_ORIGINS = True

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    # Local apps
    'accounts',
    'plants',
    'symptoms',
    'geography',
    'identification',
    'knowledge',
    'evidence',
    'safety',
    'practitioners',
    'articles',
    'notifications',
    'audit',
    'analytics',
    'preservation',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
def _database_url_config(url):
    """Parse a DATABASE_URL into Django's DATABASES format."""
    parsed = urllib.parse.urlparse(url)
    path = parsed.path or ''
    name = Path(path).name
    config = {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': name,
        'USER': parsed.username,
        'PASSWORD': parsed.password or '',
        'HOST': parsed.hostname or '127.0.0.1',
        'PORT': str(parsed.port) if parsed.port else '3306',
        'OPTIONS': {'charset': 'utf8mb4'},
    }
    return config


database_url = os.getenv('DATABASE_URL', '')
if database_url:
    # e.g. mysql://user:pass@host:3306/dbname or mysql+pymysql://...
    clean_url = re.sub(r'^mysql\+pymysql://', 'mysql://', database_url)
    DATABASES = {'default': _database_url_config(clean_url)}
elif os.getenv('DB_ENGINE', '').lower() == 'mysql' or os.getenv('DB_HOST'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': os.getenv('DB_NAME', 'herbacam'),
            'USER': os.getenv('DB_USER', 'root'),
            'PASSWORD': os.getenv('DB_PASSWORD', ''),
            'HOST': os.getenv('DB_HOST', '127.0.0.1'),
            'PORT': os.getenv('DB_PORT', '3306'),
            'OPTIONS': {
                'charset': 'utf8mb4',
            },
        }
    }
else:
    # Fallback for local development when no MySQL is configured.
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS
CORS_ALLOW_ALL_ORIGINS = True

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
    'DEFAULT_PAGINATION_CLASS': 'config.pagination.StandardPageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        'ai_identification': '30/hour',
    },
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=24),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# OpenRouter API
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
OPENROUTER_MODEL = os.getenv('OPENROUTER_MODEL', 'google/gemini-2.0-flash-exp:free')
OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

# Image upload settings
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

# Preservation risk thresholds (configurable)
RISK_THRESHOLDS = {
    'LOW': (0, 33),
    'MODERATE': (34, 66),
    'HIGH': (67, 100),
}
