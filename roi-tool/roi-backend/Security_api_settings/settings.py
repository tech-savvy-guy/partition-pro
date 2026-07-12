import os
from django.db import connection
# import configparser
import environ
from utilities.common_functions import get_from_azure_key_vault

# my_config_parser = configparser.RawConfigParser()
# my_config_parser.read('config.txt')



# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = environ.Env(DEBUG=(bool, False))

# Load .env ONLY if it exists (local development)
env_file = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_file):
    env.read_env(env_file)

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('DJANGO_SECRET', default='your-default-secret-key')
KEYMETHOD = env( 'KEYMETHOD', default='ENVIRONMENT')  # ENVIRONMENT or AZURE_KEY_VAULT
VAULT_CLIENT_ID = env('VAULT_CLIENT_ID', default='your-client-id')
VAULT_CLIENT_SECRET = env('VAULT_CLIENT_SECRET', default='your-client-secret')
VAULT_TENANT_ID = env( 'VAULT_TENANT_ID', default='your-tenant-id')
AZURE_KEYVAULT_URL = env( 'AZURE_KEY_VAULT', default='your-key-vault-url')

DEBUG = env("DEBUG", False)
#ALLOWED_HOSTS = [ 'dev.partitionpro.com','https://dev.partitionpro.com','localhost','127.0.0.1','https://dev.partitionpro.com/']
ALLOWED_HOSTS = ['*']
CORS_ORIGIN_ALLOW_ALL = True

AUTH_USER_MODEL = "Security_api.User"

# Application definition
INSTALLED_APPS = [
    'corsheaders',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'Security_api',
    'reports',
    'db_schema',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'Security_api.sanitize_input.InputSanitizerMiddleware'
]

ROOT_URLCONF = 'Security_api_settings.urls'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES':(
        # 'Security_api.authentication.CustomJWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES':[
        'rest_framework.permissions.IsAuthenticated']

}

from datetime import timedelta

PRIVATE_KEY=env("PRIVATE_KEY").replace("\\n", "\n")
PUBLIC_KEY=env("PUBLIC_KEY").replace("\\n", "\n")

# with open(os.path.join(BASE_DIR, "private.pem"), "r") as f:
#     PRIVATE_KEY = f.read()
#
# with open(os.path.join(BASE_DIR, "public.pem"), "r") as f:
#     PUBLIC_KEY = f.read()

SIMPLE_JWT={
    'ACCESS_TOKEN_LIFETIME':timedelta(minutes=5),
    'REFRESH_TOKEN_LIFETIME':timedelta(days=7),
    'AUTH_HEADER_TYPES':('Bearer',),
    'ALGORITHM':'RS256',
    'SIGNING_KEY': PRIVATE_KEY,
    "VERIFYING_KEY": PUBLIC_KEY,
    'UPDATE_LAST_LOGIN':False,
    'ROTATE_REFRESH_TOKENS':True,
    'BLACKLIST_AFTER_ROTATION':True,
    "TOKEN_BLACKLIST_ENABLED": True,
    'USER_ID_FIELD':'email',
    'USER_ID_CLAIM':'email'
}

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'Security_api_settings.wsgi.application'

# Database configuration
DATABASES = {
    'default': {
        'ENGINE': env( 'ENGINE', default='django.db.backends.postgresql'),
        'NAME': env( 'NAME', default='postgres'),
        'USER': env( 'USER', default='user'),
        'PASSWORD': env( 'PASSWORD', default="password"),#get_from_azure_key_vault('db-password'),
        'HOST': env( 'HOST', default="host"),#get_from_azure_key_vault('db-host'),
        'PORT': env( 'PORT', default='port'),
        'CONN_MAX_AGE': 0,
        'OPTIONS':{
            "sslmode": "require"
        }
    }

}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
DATA_UPLOAD_MAX_MEMORY_SIZE = 5242880000
LANGUAGE_CODE = 'en-us'
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_L10N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'


# Azure Blob
AZURE_STORAGE_CONNECTION_STRING=env("AZURE_STORAGE_CONNECTION_STRING", default='your-storage-conn-string')
AZURE_STORAGE_ACCOUNT_NAME = env("AZURE_STORAGE_ACCOUNT_NAME", default='your-storage-account-name')
AZURE_STORAGE_ACCOUNT_KEY = env("AZURE_STORAGE_ACCOUNT_KEY", default='your-storage-account-key')
AZURE_UPLOAD_CONTAINER_NAME = env("AZURE_UPLOAD_CONTAINER_NAME", default='your-upload-container-name')

# Azure Redis
REDIS_HOST = env("REDIS_HOST", default='your-redis-host')
REDIS_PORT = env("REDIS_PORT", default='6380')
REDIS_PASSWORD = env("REDIS_PASSWORD", default='your-redis-password')
REDIS_SSL = True


CELERY_BROKER_DB = 0
CELERY_RESULT_DB = 1

# ---------- Celery ----------
CELERY_TASK_ALWAYS_EAGER = False
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_TIME_LIMIT = 60
CELERY_TASK_SOFT_TIME_LIMIT = 55
CELERY_TIMEZONE = "UTC"
CELERY_TASK_TRACK_STARTED = True
# Test
CELERY_WORKER_HIJACK_ROOT_LOGGER = False
CELERY_TASK_DEFAULT_QUEUE = "calc_workflow"
CELERY_TASK_DEFAULT_EXCHANGE = "calc_workflow"
CELERY_TASK_DEFAULT_ROUTING_KEY = "calc_workflow"

CELERY_WORKER_SEND_TASK_EVENTS = True
CELERY_TASK_SEND_SENT_EVENT = True

CELERY_TASK_ROUTES = {
    "reports.tasks.process_workflow_task": {"queue": "calc_workflow"},
    "reports.tasks.process_partition_tree_task": {"queue": "calc_tree"},
    "reports.tasks.ingest_dataset_task": {"queue": "ingest"},
    "reports.tasks.compute_obm_task": {"queue": "compute_obm"},
    "reports.tasks.compute_virtual_rollup_task": {"queue": "compute_obm"}
}

# ---------- Django Cache via Redis ----------

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis{'s' if REDIS_SSL else ''}://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/2",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SSL": REDIS_SSL,
        },
        "TIMEOUT": 60,
        # Timeouts (tune to your workload)
        # "SOCKET_CONNECT_TIMEOUT": 5,   # connect timeout
        # "SOCKET_TIMEOUT": 5,           # command timeout

        # Connection pooling
        "CONNECTION_POOL_KWARGS": {
            "max_connections": 200,
            "retry_on_timeout": True,
            "health_check_interval": 30,  # helps detect dead conns
        },
    }
}

# ------------- Logging-----------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "formatter": "json",
        },
    },
    "formatters": {
        "json": {
            "format": "%(message)s",
        },
    },
    "loggers": {
        "partition_tree": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# Historical reports migrations were generated while core schema ownership was
# unclear. The db_schema app now records the application-owned PostgreSQL
# baseline; reports models remain ORM query models for core tables.
MIGRATION_MODULES = {
    "reports": None,
}
