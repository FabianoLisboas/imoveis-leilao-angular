from django.urls import path
from django.views.generic import RedirectView
from . import views

urlpatterns = [
    path('', RedirectView.as_view(url='mapa/', permanent=True), name='index'),
    path('mapa/', views.mapa_view, name='mapa'),
    path('api/mapa/', views.mapa_api, name='mapa_api'),
    path('api/propriedades/', views.propriedades_api, name='propriedades_api'),
    path('api/propriedades/<str:codigo>/', views.propriedade_detalhes_api, name='propriedade_detalhes_api'),
    path('api/cidades/<str:estado>/', views.cidades_api, name='cidades_api'),
    path('api/bairros/<str:cidade>/', views.bairros_api, name='bairros_api'),
    path('api/estados/', views.estados_api, name='estados_api'),
    path('api/tipos-imovel/', views.tipos_imovel_api, name='tipos_imovel_api'),
    path('api/analisar-matricula/', views.analisar_matricula, name='analisar_matricula'),
    path('api/proxy-imagem/', views.proxy_imagem, name='proxy_imagem'),
    path('api/imagens/<str:codigo>/', views.imagem_imovel, name='imagem_imovel'),
    path('api/config/maps-key/', views.maps_api_key, name='maps_api_key'),
    path('favoritos/', views.favoritos_view, name='favoritos'),
    path('propriedade/<str:codigo>/', views.propriedade_view, name='propriedade'),
] 