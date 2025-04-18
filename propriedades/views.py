from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from .models import Propriedade
from django.db.models import Q
import requests
import json
from django.conf import settings
import os
import uuid
from datetime import datetime
import time
from django.contrib.auth.decorators import login_required
from django.http import Http404
import random
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import viewsets
from .serializers import PropriedadeSerializer
from django.core.cache import cache
from django.http import HttpRequest
from django.http import QueryDict

# Create your views here.

def estados_api(request):
    """API para retornar lista de estados"""
    cache_key = 'estados_list'
    estados = cache.get(cache_key)
    if estados is None:
        estados = list(Propriedade.objects.values_list('estado', flat=True).distinct().order_by('estado'))
        cache.set(cache_key, estados, 3600)  # Cache por 1 hora
    return JsonResponse(estados, safe=False)

def tipos_imovel_api(request):
    """API para retornar lista de tipos de imóvel"""
    cache_key = 'tipos_imovel_list'
    tipos = cache.get(cache_key)
    if tipos is None:
        tipos = list(Propriedade.objects.values_list('tipo_imovel', flat=True).distinct().order_by('tipo_imovel'))
        cache.set(cache_key, tipos, 3600)  # Cache por 1 hora
    return JsonResponse(tipos, safe=False)

def mapa_view(request):
    """View para renderizar a página do mapa"""
    # Obter lista de estados únicos
    estados = Propriedade.objects.values_list('estado', flat=True).distinct().order_by('estado')
    
    # Obter tipos de imóveis únicos
    tipos_imovel = Propriedade.objects.values_list('tipo_imovel', flat=True).distinct().order_by('tipo_imovel')
    
    context = {
        'estados': estados,
        'tipos_imovel': tipos_imovel,
    }
    return render(request, 'propriedades/mapa.html', context)

def mapa_api(request):
    """API para retornar dados para o mapa"""
    # Verificar se há algum filtro aplicado
    tem_filtros = any([
        request.GET.get('estado'),
        request.GET.get('cidade'),
        request.GET.get('bairro'),
        request.GET.get('tipo_imovel'),
        request.GET.get('valor_max'),
        request.GET.get('desconto_min')
    ])
    
    # Se não houver filtros, retornar lista vazia
    if not tem_filtros:
        return JsonResponse({
            'count': 0,
            'results': [],
            'message': 'Selecione os filtros para buscar imóveis'
        })

    # Gerar chave de cache baseada nos filtros
    cache_key = f"mapa_api_{request.GET.urlencode()}"
    cached_data = cache.get(cache_key)
    if cached_data:
        return JsonResponse(cached_data)

    # Iniciar queryset apenas com imóveis que têm coordenadas
    queryset = Propriedade.objects.filter(
        Q(latitude__isnull=False) & 
        Q(longitude__isnull=False) &
        ~Q(latitude=0) & 
        ~Q(longitude=0)
    ).only(
        'codigo', 'tipo_imovel', 'cidade', 'estado', 'bairro',
        'valor', 'latitude', 'longitude', 'desconto', 'valor_avaliacao', 'endereco'
    ).order_by('codigo')
    
    # Aplicar filtros
    if estado := request.GET.get('estado'):
        estados = estado.split(',')
        queryset = queryset.filter(estado__in=estados)
        
    if cidade := request.GET.get('cidade'):
        cidades = cidade.split(',')
        queryset = queryset.filter(cidade__in=cidades)
        
    if bairro := request.GET.get('bairro'):
        bairros = bairro.split(',')
        queryset = queryset.filter(bairro__in=bairros)
        
    if tipo_imovel := request.GET.get('tipo_imovel'):
        tipos = tipo_imovel.split(',')
        queryset = queryset.filter(tipo_imovel__in=tipos)
        
    if valor_min_str := request.GET.get('valor_min'):
        try:
            valor_min = float(valor_min_str)
            print(f"DEBUG: Aplicando filtro valor_min: {valor_min}")
            queryset = queryset.filter(valor__gte=valor_min)
        except (ValueError, TypeError):
            print(f"DEBUG: Valor inválido para valor_min: {valor_min_str}")
            pass
        
    if valor_max_str := request.GET.get('valor_max'):
        try:
            valor_max = float(valor_max_str)
            print(f"DEBUG: Aplicando filtro valor_max: {valor_max}")
            queryset = queryset.filter(valor__lte=valor_max)
        except (ValueError, TypeError):
            print(f"DEBUG: Valor inválido para valor_max: {valor_max_str}")
            pass
        
    if desconto_min_str := request.GET.get('desconto_min'): 
        try:
            desconto_min = float(desconto_min_str) # Converter para float
            print(f"DEBUG: Aplicando filtro desconto_min: {desconto_min}")
            queryset = queryset.filter(desconto__gte=desconto_min)
        except (ValueError, TypeError):
             print(f"DEBUG: Valor inválido para desconto_min: {desconto_min_str}")
             pass

    # Contar total de resultados
    total_count = queryset.count()
    
    # Implementar paginação manual
    page_size = int(request.GET.get('page_size', 100))
    page = int(request.GET.get('page', 1))
    
    # Limitar o tamanho da página
    page_size = min(page_size, 500)
    
    # Calcular offset e limite
    start = (page - 1) * page_size
    end = start + page_size
    
    # Obter resultados da página atual
    paged_queryset = queryset[start:end]
    
    # Converter para lista de dicionários
    propriedades = []
    for prop in paged_queryset:
        propriedades.append({
            'codigo': prop.codigo,
            'tipo_imovel': prop.tipo_imovel,
            'cidade': prop.cidade,
            'estado': prop.estado,
            'bairro': prop.bairro,
            'valor': str(prop.valor),
            'latitude': str(prop.latitude),
            'longitude': str(prop.longitude),
            'desconto': str(prop.desconto or 0),
            'valor_avaliacao': str(prop.valor_avaliacao) if prop.valor_avaliacao else None,
            'endereco': prop.endereco
        })
    
    # Construir URLs de paginação
    base_url = request.build_absolute_uri().split('?')[0]
    query_params = request.GET.copy()
    
    # Próxima página
    next_page = None
    if start + page_size < total_count:
        query_params['page'] = page + 1
        next_page = f"{base_url}?{query_params.urlencode()}"
    
    # Página anterior
    previous_page = None
    if page > 1:
        query_params['page'] = page - 1
        previous_page = f"{base_url}?{query_params.urlencode()}"
    
    response_data = {
        'count': total_count,
        'results': propriedades,
        'next': next_page,
        'previous': previous_page
    }
    
    # Cache por 5 minutos (300 segundos)
    cache.set(cache_key, response_data, 300)
    
    return JsonResponse(response_data)

def propriedades_api(request):
    """API para retornar imóveis filtrados"""
    # Iniciar queryset apenas com imóveis que têm coordenadas
    queryset = Propriedade.objects.filter(
        latitude__isnull=False,
        longitude__isnull=False
    ).only(
        'codigo', 'tipo_imovel', 'cidade', 'estado',
        'valor', 'latitude', 'longitude', 'desconto'
    ).order_by('codigo')
    
    # Aplicar filtros
    if estado := request.GET.get('estado'):
        estados = estado.split(',')
        queryset = queryset.filter(estado__in=estados)
        
    if cidade := request.GET.get('cidade'):
        cidades = cidade.split(',')
        queryset = queryset.filter(cidade__in=cidades)
        
    if bairro := request.GET.get('bairro'):
        bairros = bairro.split(',')
        queryset = queryset.filter(bairro__in=bairros)
        
    if tipo_imovel := request.GET.get('tipo_imovel'):
        tipos = tipo_imovel.split(',')
        queryset = queryset.filter(tipo_imovel__in=tipos)
        
    if valor_min_str := request.GET.get('valor_min'):
        try:
            valor_min = float(valor_min_str)
            print(f"DEBUG: Aplicando filtro valor_min: {valor_min}")
            queryset = queryset.filter(valor__gte=valor_min)
        except (ValueError, TypeError):
            print(f"DEBUG: Valor inválido para valor_min: {valor_min_str}")
            pass
        
    if valor_max_str := request.GET.get('valor_max'):
        try:
            valor_max = float(valor_max_str)
            print(f"DEBUG: Aplicando filtro valor_max: {valor_max}")
            queryset = queryset.filter(valor__lte=valor_max)
        except (ValueError, TypeError):
            print(f"DEBUG: Valor inválido para valor_max: {valor_max_str}")
            pass
        
    if desconto_min_str := request.GET.get('desconto_min'): 
        try:
            desconto_min = float(desconto_min_str) # Converter para float
            print(f"DEBUG: Aplicando filtro desconto_min: {desconto_min}")
            queryset = queryset.filter(desconto__gte=desconto_min)
        except (ValueError, TypeError):
             print(f"DEBUG: Valor inválido para desconto_min: {desconto_min_str}")
             pass
        
    if quartos := request.GET.get('quartos'):
        quartos_list = quartos.split(',')
        if quartos_list:
            quartos_q = Q()
            for q in quartos_list:
                quartos_q |= Q(quartos__gte=q)
            queryset = queryset.filter(quartos_q)

    if codigo := request.GET.get('codigo'):
        queryset = queryset.filter(codigo=codigo)

    # Paginação
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 10)) # Usar 10 como padrão, igual ao frontend
    start = (page - 1) * page_size
    end = start + page_size

    # Obter o total antes de aplicar a paginação ao queryset principal
    total_count = queryset.count()

    # Aplicar paginação
    paged_queryset = queryset[start:end]

    # Converter queryset para lista de dicionários
    propriedades = list(paged_queryset.values(
        'codigo', 'tipo_imovel', 'cidade', 'estado', 'bairro', 'endereco',
        'valor', 'latitude', 'longitude', 'desconto', 'imagem_url',
        'valor_avaliacao', 'area', 'quartos', 'modalidade_venda' # Adicionar os novos campos
    ))
    
    # Garantir que valores numéricos sejam strings ou null onde apropriado
    for prop in propriedades:
        prop['valor'] = str(prop['valor']) if prop['valor'] is not None else None
        prop['latitude'] = str(prop['latitude']) if prop['latitude'] is not None else None
        prop['longitude'] = str(prop['longitude']) if prop['longitude'] is not None else None
        prop['desconto'] = str(prop['desconto']) if prop['desconto'] is not None else '0'
        prop['valor_avaliacao'] = str(prop['valor_avaliacao']) if prop['valor_avaliacao'] is not None else None
        prop['area'] = str(prop['area']) if prop['area'] is not None else None # Converter area
        # quartos e modalidade_venda não precisam de conversão extra aqui, mas são incluídos nos .values()
        
    # Construir URLs de paginação (lógica similar à mapa_api)
    base_url = request.build_absolute_uri().split('?')[0]
    query_params = request.GET.copy()
    
    next_page_url = None
    if end < total_count:
        query_params['page'] = page + 1
        next_page_url = f"{base_url}?{query_params.urlencode()}"
    
    previous_page_url = None
    if page > 1:
        query_params['page'] = page - 1
        previous_page_url = f"{base_url}?{query_params.urlencode()}"

    # Retornar JSON na estrutura esperada pelo frontend (ApiResponse)
    return JsonResponse({
        'count': total_count,
        'next': next_page_url,
        'previous': previous_page_url,
        'results': propriedades
    })

def cidades_api(request, estado):
    """API para retornar cidades de um estado"""
    cidades = Propriedade.objects.filter(
        estado=estado,
        latitude__isnull=False,
        longitude__isnull=False
    ).values_list('cidade', flat=True).distinct().order_by('cidade')
    
    return JsonResponse(list(cidades), safe=False)

def bairros_api(request, cidade):
    """API para retornar bairros de uma cidade"""
    bairros = Propriedade.objects.filter(
        cidade=cidade,
        latitude__isnull=False,
        longitude__isnull=False
    ).values_list('bairro', flat=True).distinct().order_by('bairro')
    
    return JsonResponse(list(bairros), safe=False)

@csrf_exempt
@require_http_methods(["POST"])
def analisar_matricula(request):
    """View para analisar a matrícula usando a API do Gemini"""
    try:
        data = json.loads(request.body)
        matricula_url = data.get('matricula_url')
        codigo = data.get('codigo')

        if not matricula_url or not codigo:
            return JsonResponse({'error': 'URL da matrícula ou código do imóvel não fornecidos'}, status=400)
        
        # Buscar a propriedade no banco de dados
        propriedade = Propriedade.objects.get(codigo=codigo)
        
        # Preparar o prompt com a URL da matrícula
        prompt = f"""Analise a matrícula do imóvel disponível em: {matricula_url}
        Identifique os principais pontos de atenção e precauções necessárias para aquisição deste imóvel.
        Inclua informações sobre:
        1. Restrições ou ônus
        2. Área e confrontações
        3. Possíveis problemas ou irregularidades
        4. Recomendações para aquisição
        
        Formate a resposta em markdown com títulos e subtítulos apropriados."""
        
        # Configurar a requisição para a API do Gemini
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.GEMINI_API_KEY}"
        
        headers = {
            'Content-Type': 'application/json'
        }
        
        data = {
            "contents": [{
                "parts":[{
                    "text": prompt
                }]
            }]
        }

        # Gerar ID único para esta requisição
        request_id = uuid.uuid4()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Salvar a requisição
        log_dir = os.path.join(settings.BASE_DIR, 'logs', 'gemini_requests')
        os.makedirs(log_dir, exist_ok=True)
        
        request_file = os.path.join(log_dir, f'request_{request_id}_{timestamp}.json')
        with open(request_file, 'w', encoding='utf-8') as f:
            json.dump({
                'url': url,
                'headers': headers,
                'data': data,
                'matricula_url': matricula_url,
                'codigo_imovel': codigo
            }, f, ensure_ascii=False, indent=2)
        
        print(f"\n=== INÍCIO DA REQUISIÇÃO AO GEMINI ===")
        print(f"ID da requisição: {request_id}")
        print(f"URL da matrícula: {matricula_url}")
        print(f"Payload completo: {json.dumps(data, indent=2)}")
        
        # Fazer a requisição para a API do Gemini
        response = requests.post(url, headers=headers, json=data)
        
        # Salvar a resposta
        response_file = os.path.join(log_dir, f'response_{request_id}_{timestamp}.json')
        with open(response_file, 'w', encoding='utf-8') as f:
            json.dump({
                'status_code': response.status_code,
                'headers': dict(response.headers),
                'response': response.json() if response.ok else None,
                'error': None if response.ok else response.text
            }, f, ensure_ascii=False, indent=2)
        
        print(f"Status da resposta: {response.status_code}")
        print(f"=== FIM DA REQUISIÇÃO AO GEMINI ===\n")
        
        if response.ok:
            response_json = response.json()
            if 'candidates' in response_json and len(response_json['candidates']) > 0:
                analise = response_json['candidates'][0]['content']['parts'][0]['text']
                
                # Salvar a análise no banco de dados
                propriedade.analise_matricula = analise
                propriedade.save()
                
                return JsonResponse({'success': True, 'analise': analise})
            else:
                return JsonResponse({'error': 'Resposta da API não contém o conteúdo esperado'}, status=500)
        else:
            return JsonResponse({'error': f'Erro na API do Gemini: {response.text}'}, status=response.status_code)
            
    except Propriedade.DoesNotExist:
        return JsonResponse({'error': 'Propriedade não encontrada'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido no corpo da requisição'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'Erro interno do servidor: {str(e)}'}, status=500)

@require_http_methods(["GET"])
def get_propriedade(request, codigo):
    try:
        propriedade = Propriedade.objects.get(codigo=codigo)
        return JsonResponse({
            'codigo': propriedade.codigo,
            'analise_matricula': propriedade.analise_matricula
        })
    except Propriedade.DoesNotExist:
        return JsonResponse({'error': 'Propriedade não encontrada'}, status=404)

@require_http_methods(["GET", "OPTIONS"])
def proxy_imagem(request):
    """View para servir como proxy de imagens do site da Caixa"""
    
    # Se for requisição OPTIONS, retornar apenas cabeçalhos CORS
    if request.method == "OPTIONS":
        response = HttpResponse()
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response
    
    url = request.GET.get('url')
    if not url:
        print("[PROXY] ERRO: URL não fornecida")
        return HttpResponse("URL não fornecida", status=400)
        
    print(f"[PROXY] Tentando buscar imagem da URL: {url}")
    
    # Verificar se a URL é válida
    if not url.startswith(('http://', 'https://')):
        print(f"[PROXY] ERRO: URL inválida: {url}")
        return HttpResponse("URL inválida", status=400)
    
    # Desativar avisos de SSL
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    try:
        # Lista de User-Agents para rotação
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        ]
        
        # Escolher um User-Agent aleatório
        user_agent = random.choice(user_agents)
        print(f"[PROXY] Usando User-Agent: {user_agent}")
        
        # Headers mais completos para simular um navegador real
        headers = {
            'User-Agent': user_agent,
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://venda-imoveis.caixa.gov.br/',
            'Origin': 'https://venda-imoveis.caixa.gov.br',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-origin',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
        }

        # Primeira tentativa - direta
        try:
            print(f"[PROXY] Primeira tentativa direta para URL: {url}")
            
            response = requests.get(
                url,
                headers=headers,
                verify=False,
                stream=True,
                timeout=10
            )
            
            # Verificar o tipo de conteúdo
            content_type = response.headers.get('content-type', '')
            print(f"[PROXY] Content-Type da resposta: {content_type}")
            
            # Se não for uma imagem, levantar erro
            if not content_type.startswith(('image/', 'application/octet-stream')):
                print(f"[PROXY] ERRO: Resposta não é uma imagem. Content-Type: {content_type}")
                raise ValueError(f"Resposta não é uma imagem. Content-Type: {content_type}")
            
            # Verificar status code
            response.raise_for_status()
            
            # Se conseguiu obter a imagem, retornar com cache
            print(f"[PROXY] Imagem obtida com sucesso: {url}")
            response_headers = {
                'Cache-Control': 'public, max-age=31536000',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
            return HttpResponse(
                response.content,
                content_type=response.headers.get('content-type', 'image/jpeg'),
                headers=response_headers
            )
            
        except Exception as e:
            print(f"[PROXY] ERRO ao buscar imagem: {type(e).__name__}: {str(e)}")
            
            # Em caso de erro, tentar uma segunda abordagem com sessão e cookies
            time.sleep(1)
            try:
                print(f"[PROXY] Segunda tentativa com sessão para URL: {url}")
                # Criar uma sessão para manter cookies
                session = requests.Session()
                
                # Primeiro acessar a página principal para pegar cookies
                print("[PROXY] Buscando cookies na página principal")
                session.get(
                    'https://venda-imoveis.caixa.gov.br/',
                    headers=headers,
                    verify=False,
                    timeout=10
                )
                
                # Agora buscar a imagem
                print(f"[PROXY] Buscando imagem com cookies: {url}")
                response = session.get(
                    url,
                    headers=headers,
                    verify=False,
                    stream=True,
                    timeout=10
                )
                
                # Verificar o tipo de conteúdo
                content_type = response.headers.get('content-type', '')
                print(f"[PROXY] Content-Type da resposta: {content_type}")
                
                # Se não for uma imagem, levantar erro
                if not content_type.startswith(('image/', 'application/octet-stream')):
                    print(f"[PROXY] ERRO: Resposta não é uma imagem. Content-Type: {content_type}")
                    raise ValueError(f"Resposta não é uma imagem. Content-Type: {content_type}")
                
                # Verificar status code
                response.raise_for_status()
                
                print(f"[PROXY] Imagem obtida com sucesso na segunda tentativa: {url}")
                response_headers = {
                    'Cache-Control': 'public, max-age=31536000',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
                return HttpResponse(
                    response.content,
                    content_type=response.headers.get('content-type', 'image/jpeg'),
                    headers=response_headers
                )
            except Exception as inner_e:
                print(f"[PROXY] ERRO na segunda tentativa: {type(inner_e).__name__}: {str(inner_e)}")
                # Se falhar novamente, tentar acessar a própria URL em modo texto para ver o que retorna
                try:
                    print(f"[PROXY] Verificando resposta em modo texto para URL: {url}")
                    text_response = requests.get(
                        url, 
                        headers=headers,
                        verify=False,
                        timeout=10
                    )
                    print(f"[PROXY] Status: {text_response.status_code}")
                    print(f"[PROXY] Headers: {dict(text_response.headers)}")
                    print(f"[PROXY] Primeiros 500 caracteres da resposta: {text_response.text[:500]}")
                except Exception as text_e:
                    print(f"[PROXY] ERRO ao verificar resposta de texto: {str(text_e)}")
                
                # Retornar imagem padrão
                print("[PROXY] Retornando imagem padrão após falha nas duas tentativas")
                with open('propriedades/static/img/no-image.jpg', 'rb') as f:
                    response = HttpResponse(f.read(), content_type='image/jpeg')
                    response["Access-Control-Allow-Origin"] = "*"
                    response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
                    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
                    response["Cache-Control"] = "public, max-age=86400"  # Cache por um dia
                    return response
                    
    except Exception as e:
        print(f"[PROXY] ERRO geral ao buscar imagem: {type(e).__name__}: {str(e)}")
        
        # Em caso de erro, retornar a imagem padrão
        print("[PROXY] Retornando imagem padrão após erro geral")
        with open('propriedades/static/img/no-image.jpg', 'rb') as f:
            response = HttpResponse(f.read(), content_type='image/jpeg')
            response["Access-Control-Allow-Origin"] = "*"
            response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response["Cache-Control"] = "public, max-age=86400"  # Cache por um dia
            return response

@login_required
def favoritos_view(request):
    """
    View para renderizar a página de favoritos.
    """
    return render(request, 'propriedades/favoritos.html')

@login_required
def propriedade_view(request, codigo):
    """
    View para renderizar a página de detalhes de uma propriedade.
    """
    try:
        propriedade = Propriedade.objects.get(codigo=codigo)
        return render(request, 'propriedades/propriedade.html', {'propriedade': propriedade})
    except Propriedade.DoesNotExist:
        raise Http404("Propriedade não encontrada")

@require_http_methods(["GET"])
def propriedade_detalhes_api(request, codigo):
    """
    API para retornar todos os detalhes de uma propriedade específica
    """
    try:
        propriedade = Propriedade.objects.get(codigo=codigo)
        
        # Preparar dados da propriedade incluindo todos os campos
        propriedade_dados = {
            'id': propriedade.id,
            'codigo': propriedade.codigo,
            'tipo': propriedade.tipo,
            'tipo_imovel': propriedade.tipo_imovel,
            'endereco': propriedade.endereco,
            'cidade': propriedade.cidade,
            'estado': propriedade.estado,
            'bairro': propriedade.bairro,
            'valor': float(propriedade.valor),
            'valor_avaliacao': float(propriedade.valor_avaliacao) if propriedade.valor_avaliacao else None,
            'desconto': float(propriedade.desconto) if propriedade.desconto else None,
            'descricao': propriedade.descricao,
            'modalidade_venda': propriedade.modalidade_venda,
            'area': float(propriedade.area) if propriedade.area else None,
            'area_total': float(propriedade.area_total) if propriedade.area_total else None,
            'area_privativa': float(propriedade.area_privativa) if propriedade.area_privativa else None,
            'area_terreno': float(propriedade.area_terreno) if propriedade.area_terreno else None,
            'quartos': propriedade.quartos,
            'link': propriedade.link,
            'data_atualizacao': propriedade.data_atualizacao.isoformat(),
            'latitude': float(propriedade.latitude) if propriedade.latitude else None,
            'longitude': float(propriedade.longitude) if propriedade.longitude else None,
            'imagem_url': propriedade.imagem_url,
            'imagem_cloudinary_url': propriedade.imagem_cloudinary_url,
            'imagem_cloudinary_id': propriedade.imagem_cloudinary_id,
            'matricula_url': propriedade.matricula_url,
            'analise_matricula': propriedade.analise_matricula,
        }
        
        # Adicionar CORS headers para permitir acesso do frontend
        response = JsonResponse(propriedade_dados)
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        
        return response
    
    except Propriedade.DoesNotExist:
        response = JsonResponse({'erro': 'Propriedade não encontrada'}, status=404)
        response["Access-Control-Allow-Origin"] = "*"
        return response
    except Exception as e:
        logger.error(f"Erro ao obter detalhes da propriedade {codigo}: {e}")
        response = JsonResponse({'erro': 'Erro ao obter detalhes da propriedade'}, status=500)
        response["Access-Control-Allow-Origin"] = "*"
        return response

class MapaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Propriedade.objects.all()
    serializer_class = PropriedadeSerializer

    def list(self, request, *args, **kwargs):
        # Apenas campos necessários para o mapa
        queryset = self.queryset.values(
            'id',
            'tipo_imovel',
            'valor',
            'desconto',
            'latitude',
            'longitude',
            'endereco__estado',
            'endereco__cidade',
            'endereco__bairro'
        ).filter(
            latitude__isnull=False,
            longitude__isnull=False
        ).exclude(
            latitude=0,
            longitude=0
        )

        # Paginação para limitar o número de registros
        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response(page)

        return Response(queryset)

@require_http_methods(["GET"])
def imagem_imovel(request, codigo):
    """
    View para servir a imagem de um imóvel específico pelo seu código.
    Esta função procura o imóvel pelo código, obtém sua URL de imagem
    e usa o proxy_imagem para buscar e servir a imagem.
    """
    print(f"[IMAGEM] Requisição de imagem para o imóvel: {codigo}")
    
    # Adicionar CORS header na resposta
    def add_cors_headers(response):
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response["Cache-Control"] = "public, max-age=86400"  # Cache por um dia
        return response
    
    try:
        # Buscar o imóvel no banco de dados
        propriedade = Propriedade.objects.get(codigo=codigo)
        
        # Verificar se o imóvel tem URL de imagem
        if not propriedade.imagem_url:
            print(f"[IMAGEM] Imóvel {codigo} não possui URL de imagem")
            raise Exception("Imóvel não possui imagem")
        
        print(f"[IMAGEM] URL da imagem do imóvel {codigo}: {propriedade.imagem_url}")
            
        # Redirecionar para o proxy de imagem
        mock_request = HttpRequest()
        mock_request.method = 'GET'
        mock_request.GET = QueryDict('', mutable=True)
        mock_request.GET.update({'url': propriedade.imagem_url})
        
        # Obter a resposta do proxy
        response = proxy_imagem(mock_request)
        
        # Adicionar cabeçalhos CORS
        response = add_cors_headers(response)
        
        print(f"[IMAGEM] Imagem do imóvel {codigo} retornada com sucesso")
        return response
        
    except Propriedade.DoesNotExist:
        print(f"[IMAGEM] Imóvel não encontrado: {codigo}")
        # Retornar imagem padrão
        try:
            with open('propriedades/static/img/no-image.jpg', 'rb') as f:
                response = HttpResponse(f.read(), content_type='image/jpeg')
                # Adicionar cabeçalhos CORS
                return add_cors_headers(response)
        except FileNotFoundError:
            print(f"[IMAGEM] Arquivo 'propriedades/static/img/no-image.jpg' não encontrado")
            return HttpResponse('Imagem não encontrada', status=404)
            
    except Exception as e:
        print(f"[IMAGEM] Erro ao buscar imagem do imóvel {codigo}: {e}")
        # Retornar imagem padrão
        try:
            with open('propriedades/static/img/no-image.jpg', 'rb') as f:
                response = HttpResponse(f.read(), content_type='image/jpeg')
                # Adicionar cabeçalhos CORS
                return add_cors_headers(response)
        except FileNotFoundError:
            print(f"[IMAGEM] Arquivo 'propriedades/static/img/no-image.jpg' não encontrado")
            return HttpResponse('Imagem não encontrada', status=404)

def maps_api_key(request):
    """Retorna a chave da API do Google Maps de forma segura."""
    # Tenta obter a chave do ambiente
    api_key = os.environ.get('GOOGLE_MAPS_API_KEY', '')
    
    # Se não existir no ambiente, usa a chave configurada no settings.py
    if not api_key:
        api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
    
    # Se ainda não tiver uma chave, usa a chave armazenada no settings como fallback
    if not api_key:
        api_key = '' # Retornar string vazia se nenhuma chave for encontrada
        print("AVISO: Nenhuma chave GOOGLE_MAPS_API_KEY encontrada no ambiente ou settings.")
    
    return JsonResponse({'key': api_key})
