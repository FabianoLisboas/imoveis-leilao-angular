import os
import django
import requests
import cloudinary.uploader
import logging
import time
import random
import urllib3
from dotenv import load_dotenv

# Configuração do Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'imoveis_caixa.settings')
django.setup()

# Configuração do logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('teste_imagens.log', mode='a', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# Desabilitar avisos de certificado não verificado
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Carregar variáveis de ambiente
load_dotenv()

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

class TesteImagens:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
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

    def processar_imovel(self, codigo_imovel, uf, cidade):
        """Processa um imóvel específico"""
        try:
            logging.info(f"\n{'='*50}")
            logging.info(f"Processando imóvel {codigo_imovel}")
            logging.info(f"{'='*50}")

            # Verificar se a imagem já existe localmente
            nome_arquivo = self._obter_nome_arquivo_imagem(codigo_imovel)
            diretorio_uf = self._obter_diretorio_uf(uf)
            caminho_local = os.path.join(diretorio_uf, nome_arquivo)
            imagem_existe_localmente = os.path.exists(caminho_local)
            
            logging.info(f"Verificando imagem local para imóvel {codigo_imovel}")
            logging.info(f"Caminho da imagem: {caminho_local}")
            logging.info(f"Imagem existe localmente: {imagem_existe_localmente}")

            # Se a imagem já existe localmente, não precisa fazer nada
            if imagem_existe_localmente:
                logging.info(f"Imagem já existe localmente para imóvel {codigo_imovel}")
                return True

            # Buscar URL da imagem
            url_imagem = self._obter_url_imagem(codigo_imovel)
            if url_imagem:
                logging.info(f"URL da imagem encontrada para imóvel {codigo_imovel}: {url_imagem}")
                
                # Fazer download e upload
                url_cloudinary, id_cloudinary = self._download_e_upload_imagem(
                    url_imagem, 
                    codigo_imovel,
                    uf,
                    cidade
                )
                
                if url_cloudinary and id_cloudinary:
                    logging.info(f"Processo concluído com sucesso para imóvel {codigo_imovel}")
                    return True
                else:
                    logging.error(f"Falha no processo de download/upload para imóvel {codigo_imovel}")
                    return False
            else:
                logging.warning(f"Nenhuma URL de imagem encontrada para imóvel {codigo_imovel}")
                return False

        except Exception as e:
            logging.error(f"Erro ao processar imóvel {codigo_imovel}: {str(e)}")
            return False

def main():
    # Códigos de exemplo do Acre
    imoveis_ac = [
        {"codigo": "1444404634268", "uf": "AC", "cidade": "Rio Branco"},
        {"codigo": "8787708671830", "uf": "AC", "cidade": "Rio Branco"},
        {"codigo": "8444415754438", "uf": "AC", "cidade": "Rio Branco"}
    ]
    
    teste = TesteImagens()
    
    for imovel in imoveis_ac:
        teste.processar_imovel(imovel["codigo"], imovel["uf"], imovel["cidade"])
        # Adiciona um delay entre os imóveis
        time.sleep(random.uniform(1, 2))

if __name__ == "__main__":
    main() 