from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.conf import settings
from django.conf.urls.static import static
from django.core.management import call_command
from django.http import HttpResponse
from usuarios.views import google_login, logout_view

def run_migrations(request):
    call_command('migrate')
    return HttpResponse('Migrações executadas com sucesso!')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),  # URLs do django-allauth
    path('', include('propriedades.urls')),  # URLs do app propriedades na raiz
    path('api/usuarios/', include('usuarios.urls')),  # URLs do app usuarios
    path('api/auth/google/', google_login, name='google_login'),  # URL para autenticação Google
    path('api/logout/', logout_view, name='logout'),  # URL para logout
    path('migrate/', run_migrations),  # Endpoint temporário para migrações
]

# Adicionar URLs para arquivos estáticos em desenvolvimento
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT) 