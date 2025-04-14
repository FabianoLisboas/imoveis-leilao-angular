import os
import django
import requests
import cloudinary.uploader
from io import BytesIO
from datetime import datetime
import csv
import logging
from decimal import Decimal
import re
import random
import time
import urllib3
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from dotenv import load_dotenv
from validacao_geografica import ValidadorGeografico
import sys

# Configuração do Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'imoveis_caixa.settings')
django.setup()

# Agora podemos importar os modelos
from propriedades.models import Propriedade, ImagemPropriedade

# Configuração do logging
log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'importacao.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, mode='a', encoding='utf-8', delay=False),
        logging.StreamHandler(sys.stdout)
    ]
)

# Forçar flush do buffer de logging
for handler in logging.getLogger().handlers:
    if isinstance(handler, logging.FileHandler):
        handler.flush()

# Desabilitar avisos de certificado não verificado
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Teste inicial de logging
logging.info("="*80)
logging.info("Iniciando nova execução do importador")
logging.info(f"Data e hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
logging.info("="*80)

# Configuração do Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

# Verificar se as credenciais foram carregadas
if not all([os.getenv('CLOUDINARY_CLOUD_NAME'), 
           os.getenv('CLOUDINARY_API_KEY'), 
           os.getenv('CLOUDINARY_API_SECRET')]):
    logging.error("Credenciais do Cloudinary não encontradas no arquivo .env")
    exit(1)

# Carregar variáveis de ambiente
load_dotenv()

class ImportadorCaixa:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.base_url = "https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_{}.csv"
        self.diretorio_base = 'imagens_imoveis'
        os.makedirs(self.diretorio_base, exist_ok=True)
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        }
        # Carregar chaves da API do arquivo .env
        self.api_keys = [
            os.environ.get('HERE_API_KEY_1'),
            os.environ.get('HERE_API_KEY_2'),
            os.environ.get('HERE_API_KEY_3')
        ]
        self.current_api_key_index = 0
        self.validador_geografico = ValidadorGeografico()
        self.todas_apis_indisponiveis = False  # Nova flag para controlar disponibilidade das APIs
        self.apis_com_erro = set()  # Conjunto para rastrear quais APIs já retornaram erro
        logging.info("Iniciando nova sessão de importação")

        # Inicializar a sessão com uma visita à página principal
        try:
            logging.info("Inicializando sessão com visita à página principal...")
            response = self.session.get('https://venda-imoveis.caixa.gov.br/', headers=self.headers, verify=False)
            response.raise_for_status()
            time.sleep(2)  # Aguarda 2 segundos antes de prosseguir
        except Exception as e:
            logging.error(f"Erro ao inicializar sessão: {str(e)}")

    def _get_next_api_key(self):
        """Retorna a próxima API key disponível."""
        self.current_api_key_index = (self.current_api_key_index + 1) % len(self.api_keys)
        return self.api_keys[self.current_api_key_index]

    def _limpar_valor(self, valor_texto):
        """Converte texto de valor monetário para Decimal"""
        if not valor_texto:
            return Decimal('0')
        valor = valor_texto.replace('R$', '').replace('.', '').replace(',', '.').strip()
        return Decimal(valor)

    def _extrair_area_quartos(self, descricao):
        """Extrai área e número de quartos da descrição"""
        area_total = None
        area_privativa = None
        area_terreno = None
        quartos = None
        
        if 'área total' in descricao.lower():
            import re
            match = re.search(r'(\d+[\.,]\d+)\s*de\s*área\s*total', descricao)
            if match:
                area_total = Decimal(match.group(1).replace(',', '.'))
        
        if 'área privativa' in descricao.lower():
            match = re.search(r'(\d+[\.,]\d+)\s*de\s*área\s*privativa', descricao)
            if match:
                area_privativa = Decimal(match.group(1).replace(',', '.'))
        
        if 'área do terreno' in descricao.lower():
            match = re.search(r'(\d+[\.,]\d+)\s*de\s*área\s*do\s*terreno', descricao)
            if match:
                area_terreno = Decimal(match.group(1).replace(',', '.'))

        if 'qto(s)' in descricao:
            match = re.search(r'(\d+)\s*qto\(s\)', descricao)
            if match:
                quartos = int(match.group(1))

        return area_total, area_privativa, area_terreno, quartos

    def _baixar_csv(self, url):
        """Baixa um arquivo CSV da URL fornecida, tentando HTTPS primeiro e HTTP como fallback."""
        def tentar_decodificar(content):
            """Tenta decodificar o conteúdo com diferentes codificações"""
            encodings = ['latin1', 'iso-8859-1', 'cp1252', 'utf-8', 'utf-16', 'ascii']
            for encoding in encodings:
                try:
                    texto = content.decode(encoding)
                    # Verifica se o texto decodificado contém partes do cabeçalho esperado
                    if ('imovel' in texto.lower() or 'imóvel' in texto.lower()) and \
                       ('UF' in texto or 'Cidade' in texto or 'Bairro' in texto):
                        logging.info(f"Conteúdo decodificado com sucesso usando {encoding}")
                        return texto
                except UnicodeDecodeError as e:
                    logging.warning(f"Falha ao decodificar com {encoding}: {str(e)}")
                    continue
            logging.error("Não foi possível decodificar o conteúdo com nenhuma codificação")
            # Log dos primeiros bytes do conteúdo para debug
            logging.error(f"Primeiros 100 bytes do conteúdo: {content[:100]}")
            # Log do conteúdo em hexadecimal para debug
            logging.error("Conteúdo em hexadecimal:")
            logging.error(' '.join(f'{b:02x}' for b in content[:100]))
            return None

        try:
            # Primeiro tenta com HTTPS, ignorando verificação de certificado
            logging.info(f"Tentando baixar CSV via HTTPS: {url}")
            
            # Adiciona um delay aleatório entre 1 e 3 segundos
            time.sleep(random.uniform(1, 3))
            
            response = self.session.get(url, headers=self.headers, timeout=30, verify=False)
            response.raise_for_status()
            
            # Log do tipo de conteúdo e tamanho
            logging.info(f"Tipo de conteúdo: {response.headers.get('content-type', 'não especificado')}")
            logging.info(f"Tamanho do conteúdo: {len(response.content)} bytes")
            logging.info(f"Headers da resposta:")
            for header, value in response.headers.items():
                logging.info(f"  {header}: {value}")
            
            # Tenta decodificar o conteúdo
            content = response.content
            texto_decodificado = tentar_decodificar(content)
            
            if texto_decodificado:
                # Log dos primeiros 500 caracteres do conteúdo
                logging.info(f"Primeiros 500 caracteres do conteúdo baixado:")
                logging.info(texto_decodificado[:500])
                return texto_decodificado
                
            logging.warning("Não foi possível decodificar o conteúdo com nenhuma codificação")
            return None

        except requests.exceptions.RequestException as e:
            logging.error(f"Falha ao baixar CSV via HTTPS: {str(e)}")
            logging.error(f"Detalhes do erro: {type(e).__name__}")
            if hasattr(e, 'response') and e.response is not None:
                logging.error(f"Status code: {e.response.status_code}")
                logging.error(f"Headers da resposta de erro:")
                for header, value in e.response.headers.items():
                    logging.error(f"  {header}: {value}")
                logging.error(f"Conteúdo da resposta de erro:")
                logging.error(e.response.text[:500])
            
            # Se falhou, tenta com HTTP
            http_url = url.replace('https://', 'http://')
            try:
                logging.info(f"Tentando baixar via HTTP: {http_url}")
                
                # Adiciona um delay aleatório entre 1 e 3 segundos
                time.sleep(random.uniform(1, 3))
                
                response = self.session.get(http_url, headers=self.headers, timeout=30)
                response.raise_for_status()
                
                # Log do tipo de conteúdo e tamanho
                logging.info(f"Tipo de conteúdo: {response.headers.get('content-type', 'não especificado')}")
                logging.info(f"Tamanho do conteúdo: {len(response.content)} bytes")
                logging.info(f"Headers da resposta:")
                for header, value in response.headers.items():
                    logging.info(f"  {header}: {value}")
                
                # Tenta decodificar o conteúdo
                content = response.content
                texto_decodificado = tentar_decodificar(content)
                
                if texto_decodificado:
                    # Log dos primeiros 500 caracteres do conteúdo
                    logging.info(f"Primeiros 500 caracteres do conteúdo baixado:")
                    logging.info(texto_decodificado[:500])
                    return texto_decodificado
                    
                logging.warning("Não foi possível decodificar o conteúdo com nenhuma codificação")
                return None

            except requests.exceptions.RequestException as e:
                logging.error(f"Falha ao baixar CSV via HTTP: {str(e)}")
                logging.error(f"Detalhes do erro: {type(e).__name__}")
                if hasattr(e, 'response') and e.response is not None:
                    logging.error(f"Status code: {e.response.status_code}")
                    logging.error(f"Headers da resposta de erro:")
                    for header, value in e.response.headers.items():
                        logging.error(f"  {header}: {value}")
                    logging.error(f"Conteúdo da resposta de erro:")
                    logging.error(e.response.text[:500])
                raise

    def _processar_csv(self, conteudo_csv):
        """Processa o conteúdo do CSV"""
        try:
            # Remover linhas vazias e espaços extras
            linhas = [linha for linha in conteudo_csv.splitlines() if linha.strip()]
            logging.info(f"Total de linhas no CSV após remoção de vazias: {len(linhas)}")
            
            # Encontrar a linha do cabeçalho
            linha_cabecalho = None
            for i, linha in enumerate(linhas):
                if 'N° do imóvel' in linha:
                    linha_cabecalho = i
                    logging.info(f"Cabeçalho encontrado na linha {i}")
                    break
            
            if linha_cabecalho is None:
                logging.error("Cabeçalho não encontrado no CSV!")
                logging.error("Primeiras 5 linhas do arquivo:")
                for i, linha in enumerate(linhas[:5]):
                    logging.error(f"Linha {i}: {linha}")
                return []
            
            # Criar um novo CSV apenas com o cabeçalho e os dados
            csv_processado = []
            csv_processado.append(linhas[linha_cabecalho])  # Cabeçalho
            
            # Adicionar apenas as linhas que têm dados
            linhas_validas = 0
            for linha in linhas[linha_cabecalho + 1:]:
                if linha.strip() and ';' in linha:
                    csv_processado.append(linha)
                    linhas_validas += 1
            
            logging.info(f"Total de linhas válidas encontradas: {linhas_validas}")
            
            # Usar DictReader para processar o CSV
            leitor = csv.DictReader(csv_processado, delimiter=';')
            
            # Processar as linhas
            dados = []
            for i, linha in enumerate(leitor, 1):
                try:
                    # Limpar espaços em branco dos valores
                    item = {k.strip(): v.strip() for k, v in linha.items() if k and k.strip()}
                    if item:
                        logging.debug(f"Linha {i} processada com sucesso")
                        dados.append(item)
                    else:
                        logging.warning(f"Linha {i} está vazia após processamento")
                except Exception as e:
                    logging.error(f"Erro ao processar linha {i}: {str(e)}")
                    logging.error(f"Conteúdo da linha: {linha}")
                    continue
            
            logging.info(f"Total de imóveis processados com sucesso: {len(dados)}")
            return dados
            
        except Exception as e:
            logging.error(f"Erro ao processar CSV: {str(e)}")
            logging.error(f"Tipo do erro: {type(e).__name__}")
            import traceback
            logging.error("Stack trace completo:")
            logging.error(traceback.format_exc())
            return []

    def _normalizar_texto(self, texto):
        """Normaliza o texto removendo espaços extras e caracteres problemáticos"""
        if not texto:
            return ""
            
        # Mapeamento de caracteres especiais comuns
        mapa_caracteres = {
            'Nº': 'N',
            'Nø': 'N',
            'Preço': 'Preco',
            'Endereço': 'Endereco',
            'Descrição': 'Descricao',
            'Município': 'Municipio',
            'imóvel': 'imovel',
            'avaliação': 'avaliacao'
        }
        
        texto = texto.strip()
        
        # Aplicar substituições
        for original, substituicao in mapa_caracteres.items():
            texto = texto.replace(original, substituicao)
            
        return texto

    def _limpar_banco(self):
        """Limpa todos os registros do banco antes da importação"""
        try:
            total_deletado = Propriedade.objects.all().delete()
            logging.info(f"Banco de dados limpo. {total_deletado[0]} registros removidos.")
        except Exception as e:
            logging.error(f"Erro ao limpar banco de dados: {str(e)}")

    def _extrair_tipo_imovel(self, descricao):
        """Extrai o tipo do imóvel da descrição (texto antes da primeira vírgula)"""
        if not descricao:
            return None
        
        partes = descricao.split(',', 1)
        if not partes:
            return None
            
        tipo = partes[0].strip()
        return tipo if tipo else None

    def _obter_coordenadas(self, endereco, cidade, estado):
        """Obtém as coordenadas de um endereço usando a API do Here Maps"""
        if self.todas_apis_indisponiveis:
            logging.warning("Todas as APIs do Here Maps estão indisponíveis. Pulando consulta de coordenadas.")
            return None

        try:
            # Tentar obter coordenadas com a API atual
            api_key = self.api_keys[self.current_api_key_index]
            if not api_key:
                logging.error(f"API key {self.current_api_key_index + 1} não configurada")
                return None

            url = f"https://geocode.search.hereapi.com/v1/geocode"
            params = {
                'q': endereco,
                'apiKey': api_key
            }

            response = requests.get(url, params=params)
            
            # Se receber erro 429 (Too Many Requests) ou 401 (Unauthorized)
            if response.status_code in [429, 401]:
                logging.error(f"API {self.current_api_key_index + 1} retornou erro {response.status_code}")
                self.apis_com_erro.add(self.current_api_key_index)
                
                # Se todas as APIs já retornaram erro
                if len(self.apis_com_erro) == len(self.api_keys):
                    logging.error("Todas as APIs do Here Maps retornaram erro. Desabilitando consultas.")
                    self.todas_apis_indisponiveis = True
                    return None
                
                # Tentar próxima API
                self.current_api_key_index = (self.current_api_key_index + 1) % len(self.api_keys)
                return self._obter_coordenadas(endereco, cidade, estado)

            response.raise_for_status()
            data = response.json()

            if data.get('items'):
                position = data['items'][0].get('position', {})
                latitude = position.get('lat')
                longitude = position.get('lng')

                if latitude and longitude:
                    # Validar as coordenadas
                    if self.validador_geografico.validar_coordenadas(latitude, longitude, cidade, estado):
                        return {'latitude': latitude, 'longitude': longitude}
                    else:
                        logging.warning(f"Coordenadas inválidas para o endereço: {endereco}")
                        return None

            logging.warning(f"Nenhuma coordenada encontrada para o endereço: {endereco}")
            return None

        except requests.exceptions.RequestException as e:
            logging.error(f"Erro ao obter coordenadas: {str(e)}")
            return None

    def _obter_diretorio_uf(self, uf):
        """Retorna o caminho do diretório da UF"""
        diretorio_uf = os.path.join(self.diretorio_base, uf)
        os.makedirs(diretorio_uf, exist_ok=True)
        return diretorio_uf

    def _obter_url_imagem(self, codigo_imovel):
        """Obtém a URL da imagem do imóvel usando o padrão F{id_imovel}21 com padding de zeros"""
        try:
            # Garantir que o código tenha 13 dígitos (preenchendo com zeros à esquerda)
            codigo_padded = str(codigo_imovel).zfill(13)
            url = f"https://venda-imoveis.caixa.gov.br/fotos/F{codigo_padded}21.jpg"
            logging.info(f"URL da imagem gerada: {url}")
            return url
            
        except Exception as e:
            logging.error(f"Erro ao gerar URL da imagem: {str(e)}")
            return None

    def _obter_nome_arquivo_imagem(self, codigo_imovel):
        """Gera o nome do arquivo da imagem usando o mesmo padrão da Caixa"""
        codigo_padded = str(codigo_imovel).zfill(13)
        return f"F{codigo_padded}21.jpg"

    def _download_e_upload_imagem(self, url_imagem, codigo_imovel, uf, cidade):
        """Download da imagem e upload para o Cloudinary"""
        try:
            nome_arquivo = self._obter_nome_arquivo_imagem(codigo_imovel)
            diretorio_uf = self._obter_diretorio_uf(uf)
            caminho_local = os.path.join(diretorio_uf, nome_arquivo)
            
            logging.info(f"Iniciando download da imagem para imóvel {codigo_imovel}")
            logging.info(f"URL da imagem: {url_imagem}")
            logging.info(f"Caminho local: {caminho_local}")

            # Download da imagem usando a sessão com headers
            response = self.session.get(url_imagem, headers=self.headers, verify=False)
            if response.status_code == 200:
                logging.info(f"Download concluído com sucesso para imóvel {codigo_imovel}")
                
                # Verificar se o conteúdo é uma imagem
                content_type = response.headers.get('content-type', '')
                if not content_type.startswith('image/'):
                    logging.error(f"Conteúdo não é uma imagem. Content-Type: {content_type}")
                    return None, None
                
                # Salva a imagem localmente
                with open(caminho_local, 'wb') as f:
                    f.write(response.content)
                logging.info(f"Imagem salva localmente em: {caminho_local}")
                
                # Verificar se o arquivo foi realmente criado
                if not os.path.exists(caminho_local):
                    logging.error(f"Arquivo não foi criado em: {caminho_local}")
                    return None, None
                
                # Verificar o tamanho do arquivo
                tamanho = os.path.getsize(caminho_local)
                logging.info(f"Tamanho do arquivo: {tamanho} bytes")
                
                if tamanho == 0:
                    logging.error("Arquivo criado está vazio")
                    return None, None

                # Upload para o Cloudinary
                logging.info(f"Iniciando upload para Cloudinary do imóvel {codigo_imovel}")
                result = cloudinary.uploader.upload(
                    caminho_local,
                    folder=f"imoveis/{uf}/{cidade}",
                    resource_type="image"
                )
                logging.info(f"Upload para Cloudinary concluído: {result['secure_url']}")
                return result['secure_url'], result['public_id']
            else:
                logging.error(f"Erro ao baixar imagem do imóvel {codigo_imovel}: Status {response.status_code}")
                return None, None
        except Exception as e:
            logging.error(f"Erro ao processar imagem do imóvel {codigo_imovel}: {str(e)}")
            logging.error(f"Tipo do erro: {type(e).__name__}")
            import traceback
            logging.error("Stack trace completo:")
            logging.error(traceback.format_exc())
            return None, None

    def _processar_imovel(self, dados):
        """Processa os dados de um imóvel"""
        try:
            # Obter o código do imóvel do campo correto
            codigo = dados.get('N° do imóvel', '')
            if not codigo:
                codigo = dados.get('Nº do imóvel', '')
            
            estado = dados.get('UF', '')
            cidade = dados.get('Cidade', '')
            
            # Verificar se o imóvel já existe
            imovel_existente = Propriedade.objects.filter(codigo=codigo).first()
            
            # Verificar se precisa baixar a imagem
            url_imagem = self._obter_url_imagem(codigo)
            url_cloudinary = None
            id_cloudinary = None
            
            if url_imagem:
                nome_arquivo = self._obter_nome_arquivo_imagem(codigo)
                diretorio_uf = self._obter_diretorio_uf(estado)
                caminho_local = os.path.join(diretorio_uf, nome_arquivo)
                
                # Se a imagem não existe localmente, baixa e faz upload
                if not os.path.exists(caminho_local):
                    logging.info(f"Baixando imagem para imóvel {codigo}")
                    url_cloudinary, id_cloudinary = self._download_e_upload_imagem(
                        url_imagem, 
                        codigo,
                        estado,
                        cidade
                    )
                    
                    # Se o imóvel existe, atualiza as URLs do Cloudinary
                    if imovel_existente and url_cloudinary and id_cloudinary:
                        imovel_existente.imagem_cloudinary_url = url_cloudinary
                        imovel_existente.imagem_cloudinary_id = id_cloudinary
                        imovel_existente.save()
                        logging.info(f"URLs do Cloudinary atualizadas para imóvel {codigo}")
            
            # Se o imóvel já existe e tem coordenadas, não precisa fazer mais nada
            if imovel_existente and imovel_existente.latitude and imovel_existente.longitude:
                return
            
            # Se o imóvel existe mas não tem coordenadas, atualiza
            if imovel_existente:
                # Construir o endereço com os campos corretos
                endereco = dados.get('Endereço', '')
                bairro = dados.get('Bairro', '')
                endereco_completo = f"{endereco}, {bairro}, {cidade}, {estado}"
                
                coordenadas = self._obter_coordenadas(endereco_completo, cidade, estado)
                
                if coordenadas:
                    imovel_existente.latitude = coordenadas['latitude']
                    imovel_existente.longitude = coordenadas['longitude']
                    imovel_existente.save()
                    logging.info(f"Coordenadas atualizadas para imóvel {codigo}")
                return

            # Se chegou aqui, é um imóvel novo
            area_total, area_privativa, area_terreno, quartos = self._extrair_area_quartos(dados.get('Descrição', ''))
            tipo_imovel = self._extrair_tipo_imovel(dados.get('Descrição', ''))
            
            # Construir o endereço com os campos corretos
            endereco = dados.get('Endereço', '')
            bairro = dados.get('Bairro', '')
            endereco_completo = f"{endereco}, {bairro}, {cidade}, {estado}"
            
            coordenadas = self._obter_coordenadas(endereco_completo, cidade, estado)
            
            imovel = Propriedade(
                codigo=codigo,
                tipo=tipo_imovel,
                descricao=dados.get('Descrição', ''),
                endereco=endereco_completo,
                bairro=bairro,
                cidade=cidade,
                estado=estado,
                cep=dados.get('CEP', ''),
                area_total=area_total,
                area_privativa=area_privativa,
                area_terreno=area_terreno,
                quartos=quartos,
                valor=self._limpar_valor(dados.get('Preço', '0')),
                valor_avaliacao=self._limpar_valor(dados.get('Valor de avaliação', '0')),
                desconto=self._limpar_valor(dados.get('Desconto', '0')),
                modalidade_venda=dados.get('Modalidade de venda', ''),
                link=dados.get('Link de acesso', ''),
                latitude=coordenadas['latitude'] if coordenadas else None,
                longitude=coordenadas['longitude'] if coordenadas else None,
                imagem_url=url_imagem,
                imagem_cloudinary_url=url_cloudinary,
                imagem_cloudinary_id=id_cloudinary
            )
            
            imovel.save()
            logging.info(f"Imóvel {codigo} salvo com sucesso")
            
        except Exception as e:
            logging.error(f"Erro ao processar imóvel {codigo}: {str(e)}")
            logging.error(f"Tipo do erro: {type(e).__name__}")
            import traceback
            logging.error("Stack trace completo:")
            logging.error(traceback.format_exc())

    def _validar_csv(self, conteudo):
        """Valida se o conteúdo parece ser um CSV válido"""
        try:
            # Verificar se tem o cabeçalho esperado
            colunas_esperadas = [
                'N° do imóvel',
                'UF',
                'Cidade',
                'Bairro',
                'Endereço',
                'Preço',
                'Valor de avaliação',
                'Desconto',
                'Descrição',
                'Modalidade de venda',
                'Link de acesso'
            ]
            
            # Remover linhas vazias e espaços extras
            linhas = [linha.strip() for linha in conteudo.splitlines() if linha.strip()]
            
            # Procurar linha do cabeçalho
            for linha in linhas:
                if 'N° do imóvel' in linha or 'Nº do imóvel' in linha:
                    # Verificar se a maioria das colunas esperadas está presente
                    colunas_encontradas = 0
                    for coluna in colunas_esperadas:
                        if coluna in linha:
                            colunas_encontradas += 1
                    
                    # Se encontrou pelo menos 70% das colunas esperadas
                    if colunas_encontradas >= len(colunas_esperadas) * 0.7:
                        print("Cabeçalho válido encontrado")
                        return True
            
            print("Cabeçalho válido não encontrado")
            return False
            
        except Exception as e:
            print(f"Erro ao validar CSV: {str(e)}")
            return False

    def importar(self):
        """Importa os dados de todos os estados"""
        try:
            total_imoveis = 0
            total_removidos = 0
            total_atualizados = 0
            total_novos = 0

            # Lista de estados para processar
            estados = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

            for estado in estados:
                logging.info(f"Processando estado: {estado}")
                
                # Baixar CSV do estado
                url = self.base_url.format(estado)
                conteudo_csv = self._baixar_csv(url)
                
                if not conteudo_csv:
                    logging.error(f"Não foi possível baixar o CSV do estado {estado}")
                    continue
                
                # Processar CSV
                dados = self._processar_csv(conteudo_csv)
                if not dados:
                    logging.error(f"Não foi possível processar o CSV do estado {estado}")
                    continue
                
                # Obter imóveis existentes no banco
                imoveis_existentes = Propriedade.objects.filter(estado=estado)
                codigos_existentes = set(imoveis_existentes.values_list('codigo', flat=True))
                codigos_csv = set(d['N° do imóvel'] for d in dados if d.get('N° do imóvel'))
                
                # Remover imóveis que não estão mais no CSV
                imoveis_para_remover = codigos_existentes - codigos_csv
                if imoveis_para_remover:
                    Propriedade.objects.filter(codigo__in=imoveis_para_remover).delete()
                    total_removidos += len(imoveis_para_remover)
                    logging.info(f"Removidos {len(imoveis_para_remover)} imóveis do estado {estado}")
                
                # Processar cada imóvel do CSV
                for dados_imovel in dados:
                    try:
                        codigo = dados_imovel.get('N° do imóvel', '')
                        if not codigo:
                            continue
                            
                        # Verificar se o imóvel já existe
                        imovel_existente = Propriedade.objects.filter(codigo=codigo).first()
                        
                        # Processa o imóvel (seja novo ou existente)
                        self._processar_imovel(dados_imovel)
                        
                        # Atualiza os contadores
                        if imovel_existente:
                            total_atualizados += 1
                        else:
                            total_novos += 1
                            
                        total_imoveis += 1
                        
                    except Exception as e:
                        logging.error(f"Erro ao processar imóvel {codigo}: {str(e)}")
                        continue
                
                logging.info(f"Estado {estado} processado com sucesso")
                logging.info(f"Total de imóveis processados: {total_imoveis}")
                logging.info(f"Total de imóveis removidos: {total_removidos}")
                logging.info(f"Total de imóveis atualizados: {total_atualizados}")
                logging.info(f"Total de imóveis novos: {total_novos}")
            
            logging.info("Importação concluída com sucesso")
            return {
                'total_imoveis': total_imoveis,
                'total_removidos': total_removidos,
                'total_atualizados': total_atualizados,
                'total_novos': total_novos
            }
            
        except Exception as e:
            logging.error(f"Erro durante a importação: {str(e)}")
            logging.error(f"Tipo do erro: {type(e).__name__}")
            import traceback
            logging.error("Stack trace completo:")
            logging.error(traceback.format_exc())
            return None

def main():
    importador = ImportadorCaixa()
    importador.importar()

if __name__ == "__main__":
    main()