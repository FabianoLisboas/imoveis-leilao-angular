import { Component, Input, Output, EventEmitter, OnInit, PLATFORM_ID, Inject, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';
import { Imovel } from '../../models/imovel';
import { FavoritosService } from '../../services/favoritos.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-imovel-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule
  ],
  templateUrl: './imovel-card.component.html',
  styleUrls: ['./imovel-card.component.scss']
})
export class ImovelCardComponent implements OnInit, OnDestroy {
  @Input() imovel!: Imovel;
  @Output() toggleFavorito = new EventEmitter<Imovel>();
  
  imagemUrl: string = '/assets/images/no-image.jpg';
  imagemCarregando: boolean = true;
  imagemComErro: boolean = false;
  public isBrowser: boolean;
  
  // Novas propriedades de estado para favoritos
  isFavorito = false;
  isTogglingFavorite = false;
  private favoritosSub?: Subscription;
  
  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private favoritosService: FavoritosService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    console.log('ImovelCardComponent - isBrowser:', this.isBrowser);
  }
  
  ngOnInit(): void {
    if (this.isBrowser) {
      this.configurarImagemUrl();
      // Verificar estado inicial do favorito
      this.verificarEstadoFavorito();
      // Inscrever-se para mudanças nos favoritos
      this.favoritosSub = this.favoritosService.favoritos.subscribe((codigosFavoritos) => {
        // Atualizar o estado isFavorito baseado na nova lista
        this.isFavorito = codigosFavoritos.includes(this.imovel?.codigo);
        this.cdr.detectChanges();
      });
    } else {
      console.log('Componente iniciado em modo servidor, imagem não será carregada');
    }
  }
  
  ngOnDestroy(): void {
    if (this.favoritosSub) {
      this.favoritosSub.unsubscribe();
    }
  }
  
  private verificarEstadoFavorito(): void {
    if (this.imovel?.codigo) {
      this.isFavorito = this.favoritosService.isFavorito(this.imovel.codigo);
      this.cdr.detectChanges();
    }
  }
  
  private configurarImagemUrl(): void {
    console.log(`🖼️ [DEBUG] Configurando URL da imagem para imóvel ${this.imovel.codigo}, com imagem_url: "${this.imovel.imagem_url}"`);
    
    if (this.imovel && this.imovel.codigo) {
      // Tentar diferentes estratégias para obter a imagem
      if (this.imovel.imagem_url && this.imovel.imagem_url.startsWith('http')) {
        // Se o imóvel já tiver uma URL de imagem completa, usar essa URL diretamente
        this.imagemUrl = this.imovel.imagem_url;
        console.log(`🔗 [DEBUG] Usando URL direta da imagem: ${this.imagemUrl}`);
      } else if (this.imovel.codigo) {
        // Caso contrário, usar o endpoint do backend para buscar a imagem pelo código
        // Adicionar timestamp para evitar cache
        const timestamp = new Date().getTime();
        this.imagemUrl = `/api/imagens/${this.imovel.codigo}/?t=${timestamp}`;
        console.log(`🔍 [DEBUG] Usando endpoint de API para imagem: ${this.imagemUrl}`);
      } else {
        console.log('⚠️ [DEBUG] Imóvel sem código válido, usando imagem padrão');
        this.imagemUrl = '/assets/images/no-image.jpg';
      }
    } else {
      console.log('⚠️ [DEBUG] Imóvel sem dados, usando imagem padrão');
      this.imagemUrl = '/assets/images/no-image.jpg';
    }
  }

  formatarMoeda(valor: string): string {
    if (!valor) return 'R$ 0,00';
    
    try {
      const valorLimpo = typeof valor === 'string' 
        ? valor.replace(/[^0-9,.-]/g, '').replace(',', '.') 
        : valor;
      const numero = parseFloat(String(valorLimpo));
      
      if (isNaN(numero)) return 'R$ 0,00';
      
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(numero);
    } catch (error) {
      console.error('Erro ao formatar valor:', error);
      return 'R$ 0,00';
    }
  }
  
  aoCarregarImagem() {
    console.log(`✅ [DEBUG] Imagem carregada com sucesso: ${this.imagemUrl}`);
    this.imagemCarregando = false;
    this.imagemComErro = false;
  }

  aoErroImagem() {
    console.error(`❌ [DEBUG] ERRO ao carregar imagem: ${this.imagemUrl}`);
    
    // Verificar se a URL é do backend ou externa
    const isApiUrl = this.imagemUrl.startsWith('/api/');
    if (isApiUrl) {
      console.error(`🧪 [DEBUG] Falha ao carregar imagem do backend - testando diretamente a URL externa`);
      
      // Tentar diretamente a URL da imagem se disponível
      if (this.imovel.imagem_url && this.imovel.imagem_url.startsWith('http')) {
        console.log(`🧪 [DEBUG] Tentando URL externa: ${this.imovel.imagem_url}`);
        this.imagemUrl = this.imovel.imagem_url;
        return; // Não marcar erro ainda, deixar tentar a URL externa
      }
    }
    
    // Se a URL atual não for a imagem padrão, tentar a imagem padrão
    if (!this.imagemUrl.includes('no-image.jpg')) {
      console.log('🔄 [DEBUG] Tentando carregar imagem padrão');
      this.imagemComErro = true;
      
      // Atualizar URL para a imagem padrão com timestamp para evitar cache
      const timestamp = new Date().getTime();
      this.imagemUrl = `/assets/images/no-image.jpg?t=${timestamp}`;
    } else {
      // Se a imagem padrão também falhar, pelo menos mostrar que terminou de carregar
      console.error('❌❌ [DEBUG] Até a imagem padrão falhou ao carregar');
      this.imagemCarregando = false;
      this.imagemComErro = true;
    }
  }

  getEnderecoLinha1(): string {
    // Mostrar endereço completo na primeira linha
    if (this.imovel.endereco && this.imovel.endereco.trim() !== '') {
      return this.imovel.endereco;
    }
    return 'Endereço não disponível';
  }
  
  getEnderecoLinha2(): string {
    // Adicionar o bairro junto com cidade e estado
    const bairro = this.imovel.bairro ? `${this.imovel.bairro}, ` : '';
    return `${bairro}${this.imovel.cidade || ''} - ${this.imovel.estado || ''}`;
  }

  navegarParaDetalhes() {
    // Navegar para a página de detalhes
    this.router.navigate(['/imovel', this.imovel.codigo]);
  }

  toggleFavoritoStatus(): void {
    if (!this.imovel?.codigo || this.isTogglingFavorite) {
      return;
    }
    
    this.isTogglingFavorite = true;
    this.cdr.detectChanges();

    // Chamar o serviço para alternar o favorito
    this.favoritosService.toggleFavorito(this.imovel.codigo, this.imovel).subscribe({
      next: (resultado) => {
        if (resultado.status === 'success') {
          this.isFavorito = resultado.action === 'added';
          const mensagem = this.isFavorito 
            ? 'Imóvel adicionado aos favoritos' 
            : 'Imóvel removido dos favoritos';
          this.snackBar.open(mensagem, 'Fechar', {
            duration: 3000,
            horizontalPosition: 'center',
          });
        } else {
          // Tratar caso de falha reportada pelo serviço (se houver)
          this.snackBar.open('Erro ao gerenciar favoritos (1)', 'Fechar', { duration: 5000 });
        }
      },
      error: (erro) => {
        console.error('Erro ao alternar favorito no card:', erro);
        this.snackBar.open('Erro ao gerenciar favoritos (2)', 'Fechar', {
          duration: 5000,
        });
      },
      complete: () => {
        this.isTogglingFavorite = false;
        this.cdr.detectChanges();
      }
    });
  }
}
