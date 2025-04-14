from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from google.oauth2 import id_token
from google.auth.transport import requests
from django.contrib.auth.models import User
from .models import PerfilUsuario, PreferenciasUsuario, Favorito
from propriedades.models import Propriedade
import json
from django.db import transaction

# Função personalizada para verificar autenticação em APIs
def api_login_required(view_func):
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({
                'authenticated': False,
                'message': 'Usuário não autenticado'
            }, status=401)
        return view_func(request, *args, **kwargs)
    return _wrapped_view

# Create your views here.

def get_current_user(request):
    """Retorna informações do usuário atualmente logado ou status não autenticado."""
    if not request.user.is_authenticated:
        return JsonResponse({
            'authenticated': False,
            'message': 'Usuário não autenticado'
        })

    try:
        perfil = PerfilUsuario.objects.get(usuario=request.user)
        return JsonResponse({
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'nome': request.user.first_name,
            'sobrenome': request.user.last_name,
            'google_id': perfil.google_id,
            'authenticated': True
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def google_login(request):
    if request.method == 'POST':
        try:
            print("Recebido POST para google_login")
            print(f"Tipo de conteúdo: {request.content_type}")
            
            # Verificar de onde vem o token (POST ou body)
            token = None
            
            # Se for application/x-www-form-urlencoded
            if request.content_type == 'application/x-www-form-urlencoded':
                token = request.POST.get('token')
                print(f"Token obtido de POST: {token[:20]}..." if token else "Token não encontrado em POST")
            
            # Se for json
            elif request.content_type == 'application/json':
                data = json.loads(request.body)
                token = data.get('token')
                print(f"Token obtido de JSON: {token[:20]}..." if token else "Token não encontrado em JSON")
            
            # Tenta obter diretamente do body como fallback
            if not token and request.body:
                try:
                    # Tenta interpretar o corpo como um formulário codificado
                    import urllib.parse
                    body_str = request.body.decode('utf-8')
                    print(f"Body recebido: {body_str[:100]}...")
                    
                    form_data = urllib.parse.parse_qs(body_str)
                    token = form_data.get('token', [''])[0]
                    print(f"Token obtido do body como form: {token[:20]}..." if token else "Token não encontrado no body como form")
                except Exception as e:
                    print(f"Erro ao tentar parse do body: {str(e)}")
            
            if not token:
                return JsonResponse({'status': 'error', 'message': 'Token não fornecido'})
            
            print("Verificando token com Google...")
            idinfo = id_token.verify_oauth2_token(token, requests.Request(), settings.GOOGLE_CLIENT_ID)
            
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')
            
            email = idinfo['email']
            google_id = idinfo['sub']
            
            print(f"Token verificado com sucesso. Email: {email}")
            
            # Busca ou cria o usuário
            user = User.objects.filter(email=email).first()
            if not user:
                username = email.split('@')[0]
                user = User.objects.create_user(username=username, email=email)
                print(f"Usuário criado: {username}")
            else:
                print(f"Usuário encontrado: {user.username}")
            
            # Atualiza ou cria o perfil
            perfil, created = PerfilUsuario.objects.get_or_create(
                usuario=user,
                defaults={'google_id': google_id}
            )
            
            if not created:
                perfil.google_id = google_id
                perfil.save()
            
            print(f"Perfil {'criado' if created else 'atualizado'} para {user.username}")
            
            # Especificar o backend de autenticação explicitamente
            from django.contrib.auth import authenticate
            from django.contrib.auth.backends import ModelBackend
            
            # Autenticar o usuário com o backend padrão do Django
            authenticated_user = authenticate(request, username=user.username, password=None, backend='django.contrib.auth.backends.ModelBackend')
            
            if not authenticated_user:
                # Se não conseguiu autenticar, definir manualmente o backend
                user.backend = 'django.contrib.auth.backends.ModelBackend'
                authenticated_user = user
            
            # Fazer login com o usuário autenticado
            login(request, authenticated_user)
            
            # Verificar se o login foi bem-sucedido
            if request.user.is_authenticated:
                print(f"Login bem-sucedido para {user.username}")
            else:
                print(f"ATENÇÃO: Usuário não está autenticado após login!")
            
            return JsonResponse({
                'status': 'success',
                'user': {
                    'username': user.username,
                    'email': user.email
                }
            })
            
        except Exception as e:
            print(f"Erro na autenticação com Google: {str(e)}")
            import traceback
            traceback.print_exc()
            return JsonResponse({'status': 'error', 'message': str(e)})
    
    return JsonResponse({'status': 'error', 'message': 'Método não permitido'})

@csrf_exempt
def logout_view(request):
    logout(request)
    return JsonResponse({'status': 'success'})

@api_login_required
def get_preferencias(request):
    perfil = request.user.perfilusuario
    preferencias, created = PreferenciasUsuario.objects.get_or_create(usuario=perfil)
    return JsonResponse({
        'tipo_imovel': preferencias.tipo_imovel,
        'preco_minimo': float(preferencias.preco_minimo) if preferencias.preco_minimo else None,
        'preco_maximo': float(preferencias.preco_maximo) if preferencias.preco_maximo else None,
        'cidade': preferencias.cidade,
        'estado': preferencias.estado,
        'area_minima': float(preferencias.area_minima) if preferencias.area_minima else None,
        'area_maxima': float(preferencias.area_maxima) if preferencias.area_maxima else None,
        'notificacoes_ativas': preferencias.notificacoes_ativas
    })

@api_login_required
def salvar_preferencias(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            perfil = request.user.perfilusuario
            preferencias, created = PreferenciasUsuario.objects.get_or_create(usuario=perfil)
            
            preferencias.tipo_imovel = data.get('tipo_imovel')
            preferencias.preco_minimo = data.get('preco_minimo')
            preferencias.preco_maximo = data.get('preco_maximo')
            preferencias.cidade = data.get('cidade')
            preferencias.estado = data.get('estado')
            preferencias.area_minima = data.get('area_minima')
            preferencias.area_maxima = data.get('area_maxima')
            preferencias.notificacoes_ativas = data.get('notificacoes_ativas', True)
            
            preferencias.save()
            return JsonResponse({'status': 'success'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)})
    
    return JsonResponse({'status': 'error', 'message': 'Método não permitido'})

@csrf_exempt
@api_login_required
@transaction.atomic
def toggle_favorito(request, codigo):
    """
    Adiciona ou remove um imóvel dos favoritos do usuário.
    Requer que o usuário esteja autenticado.
    """
    print(f"[FAVORITOS BACKEND] Iniciando toggle para {codigo} por usuário {request.user.username}")
    try:
        propriedade = Propriedade.objects.get(codigo=codigo)
        print(f"[FAVORITOS BACKEND] Propriedade {codigo} encontrada.")
        perfil = request.user.perfilusuario
        print(f"[FAVORITOS BACKEND] Perfil {perfil.id} encontrado.")
        
        favorito = Favorito.objects.filter(usuario=perfil, propriedade=propriedade).first()
        
        if favorito:
            # Remover dos favoritos
            favorito_id_para_log = favorito.id
            print(f"[FAVORITOS BACKEND] Encontrado favorito existente (ID: {favorito_id_para_log}). Removendo...")
            try:
                favorito.delete()
                print(f"[FAVORITOS BACKEND] Favorito ID {favorito_id_para_log} removido com sucesso.")
                return JsonResponse({'status': 'success', 'action': 'removed'})
            except Exception as delete_error:
                print(f"[FAVORITOS BACKEND] ERRO AO DELETAR favorito ID {favorito_id_para_log}: {delete_error}")
                raise
        else:
            # Adicionar aos favoritos
            print(f"[FAVORITOS BACKEND] Favorito não existente para {codigo}. Adicionando...")
            try:
                novo_favorito = Favorito.objects.create(usuario=perfil, propriedade=propriedade)
                print(f"[FAVORITOS BACKEND] Novo favorito criado com ID: {novo_favorito.id}")
                return JsonResponse({'status': 'success', 'action': 'added'})
            except Exception as create_error:
                print(f"[FAVORITOS BACKEND] ERRO AO CRIAR favorito para {codigo}: {create_error}")
                raise
            
    except Propriedade.DoesNotExist:
        print(f"[FAVORITOS BACKEND] ERRO: Propriedade {codigo} não encontrada.")
        return JsonResponse({'status': 'error', 'message': 'Propriedade não encontrada'}, status=404)
    except PerfilUsuario.DoesNotExist:
        print(f"[FAVORITOS BACKEND] ERRO: Perfil para usuário {request.user.username} não encontrado.")
        return JsonResponse({'status': 'error', 'message': 'Perfil de usuário não encontrado'}, status=400)
    except Exception as e:
        import traceback
        print(f"[FAVORITOS BACKEND] ERRO GERAL INESPERADO ou ERRO DURANTE CREATE/DELETE para {codigo}: {e}")
        traceback.print_exc()
        return JsonResponse({'status': 'error', 'message': f'Erro interno no servidor: {str(e)}'}, status=500)

@api_login_required
def get_favoritos(request):
    """
    Retorna a lista de imóveis favoritos do usuário.
    Requer que o usuário esteja autenticado.
    """
    try:
        favoritos = Favorito.objects.filter(usuario=request.user.perfilusuario).select_related('propriedade')
        
        resultado = []
        for f in favoritos:
            try:
                item = {
                    'codigo': f.propriedade.codigo,
                    'tipo_imovel': f.propriedade.tipo_imovel,
                    'endereco': f.propriedade.endereco,
                    'estado': f.propriedade.estado,
                    'cidade': f.propriedade.cidade,
                    'bairro': f.propriedade.bairro,
                    'valor': float(f.propriedade.valor) if f.propriedade.valor else None,
                    'desconto': f.propriedade.desconto,
                    'imagem_url': f.propriedade.imagem_url,
                    'data_adicao': f.data_adicao.isoformat(),
                    'link': f.propriedade.link
                }
                resultado.append(item)
            except Exception as e:
                continue
                
        return JsonResponse({'favoritos': resultado})
    except PerfilUsuario.DoesNotExist:
        return JsonResponse({'favoritos': []}) # Retorna vazio se o perfil não existe
    except Exception as e:
        return JsonResponse({'favoritos': []}, status=500) # Retorna vazio em caso de erro
