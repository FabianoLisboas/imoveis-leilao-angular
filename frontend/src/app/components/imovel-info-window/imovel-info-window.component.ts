import { Component, Input, Output, EventEmitter, ElementRef, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule, Router } from '@angular/router';
import { Imovel } from '../../models/imovel';
import { environment } from '../../../environments/environment';
import { FavoritosService } from '../../services/favoritos.service';
import { AuthService } from '../../services/auth/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-imovel-info-window',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, RouterModule],
  template: `
    <div class="custom-info-window">
      <button (click)="onClose()" class="close-button">×</button>
      
      <div class="image-container">
        <img [src]="getImageUrl()" [alt]="imovel?.descricao || 'Imagem do imóvel'" class="property-image"
             (error)="onImageError($event)">
      </div>
      
      <div class="info-content">
        <h3 class="titulo">{{ imovel?.tipo_imovel || 'Imóvel' }} - {{ imovel?.codigo || '' }}</h3>
        
        <p class="endereco-completo">
          {{ getEnderecoFormatado() }}
        </p>
        
        <p class="valor-venda">Valor de Venda: {{ formatarValor(imovel?.valor) }}</p>
        
        <p class="valor-avaliacao" *ngIf="imovel?.valor_avaliacao">
          Valor de Avaliação: {{ formatarValor(imovel?.valor_avaliacao) }}
        </p>
        
        <p class="desconto" *ngIf="temDesconto()">
          Desconto: {{ formatarPorcentagem(imovel?.desconto) }}
        </p>
        
        <p class="detalhes-adicionais">
          <ng-container *ngIf="imovel?.quartos">{{ imovel?.quartos }} quartos</ng-container>
          <ng-container *ngIf="imovel?.quartos && imovel?.area"> | </ng-container>
          <ng-container *ngIf="imovel?.area">{{ formatarArea(imovel?.area) }}</ng-container>
        </p>
        
        <div class="actions">
          <a [routerLink]="['/propriedade', imovel?.codigo]" class="action-button detalhes-button">
            <span class="material-icons">visibility</span>
            Ver detalhes
          </a>
          
          <button (click)="onFavoritar()" class="action-button favoritar-button">
            <span class="material-icons">{{ isFavorito ? 'favorite' : 'favorite_border' }}</span>
          </button>
        </div>
        
        <div class="matricula-link" *ngIf="imovel?.matricula">
          <a [routerLink]="['/propriedade', imovel?.codigo, 'matricula']">
            <span class="material-icons">description</span>
            Ver Matrícula Completa
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .custom-info-window {
      position: absolute; /* Controlado pelo componente pai */
      width: 320px;
      max-height: 400px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      overflow: hidden;
      pointer-events: auto;
    }
    
    .custom-info-window::after {
      content: '';
      position: absolute;
      bottom: -10px;
      left: 50%;
      width: 0;
      height: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-top: 10px solid white;
      transform: translateX(-50%);
    }
    
    .close-button {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.6);
      color: white;
      border: none;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      z-index: 10;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .image-container {
      height: 156px;
      width: 100%;
      overflow: hidden;
      border-radius: 8px 8px 0 0;
    }
    
    .property-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      margin: 0 auto;
    }
    
    .info-content {
      padding: 12px;
    }
    
    .titulo {
      margin: 0 0 4px 0;
      font-size: 16px;
      font-weight: 600;
      color: #3f51b5;
    }
    
    .endereco-completo {
      margin: 4px 0;
      font-size: 13px;
      color: #666;
      line-height: 1.3;
    }
    
    .valor-venda {
      margin: 4px 0;
      font-weight: 600;
      font-size: 14px;
    }
    
    .valor-avaliacao {
      margin: 4px 0;
      font-size: 14px;
    }
    
    .desconto {
      margin: 4px 0;
      color: #4CAF50;
      font-weight: 600;
      font-size: 14px;
    }
    
    .detalhes-adicionais {
      margin: 8px 0;
      font-size: 14px;
    }
    
    .actions {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
    }
    
    .action-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      text-decoration: none;
    }
    
    .detalhes-button {
      background: #3f51b5;
      color: white;
      flex: 1;
      min-width: 110px;
      text-align: center;
    }
    
    .favoritar-button {
      background: white;
      border: 1px solid #dc3545 !important;
      color: #dc3545;
      width: 40px;
      padding: 6px 10px;
      margin-left: 6px;
    }
    
    .matricula-link {
      text-align: center;
      margin-top: 8px;
      font-size: 13px;
    }
    
    .matricula-link a {
      color: #3f51b5;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    
    .material-icons {
      font-size: 16px;
    }
  `]
})
export class ImovelInfoWindowComponent implements OnInit, OnDestroy {
  @Input() imovel: Imovel | null = null;
  @Input() position: { x: number, y: number } | null = null;
  @Input() map: google.maps.Map | null = null;
  
  @Output() close = new EventEmitter<void>();
  @Output() favoritar = new EventEmitter<Imovel>();
  @Output() verDetalhes = new EventEmitter<Imovel>();
  
  // Propriedades de estado
  isFavorito = false;
  isTogglingFavorite = false;
  private favoritosSub?: Subscription;
  
  constructor(
    private el: ElementRef,
    private cdr: ChangeDetectorRef,
    private favoritosService: FavoritosService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}
  
  ngOnInit(): void {
    if (this.position) {
      this.posicionarInfoWindow();
    }
    
    // Escutar mudanças nos favoritos para atualizar o ícone
    if (this.imovel?.codigo) {
      this.favoritosSub = this.favoritosService.favoritos.subscribe(codigos => {
        this.isFavorito = codigos.includes(this.imovel!.codigo);
        this.cdr.detectChanges();
      });
      // Verificar estado inicial
      this.isFavorito = this.favoritosService.isFavorito(this.imovel.codigo);
    }

    // Adicionar listener para fechar ao clicar fora
    document.addEventListener('click', this.handleOutsideClick, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.handleOutsideClick, true);
    this.favoritosSub?.unsubscribe();
  }

  private handleOutsideClick = (event: MouseEvent) => {
    if (!this.el.nativeElement.contains(event.target)) {
      this.onClose();
    }
  }

  private posicionarInfoWindow(): void {
    // Lógica para posicionar o InfoWindow (exemplo simplificado)
    if (this.position) {
      this.el.nativeElement.style.left = `${this.position.x}px`;
      this.el.nativeElement.style.top = `${this.position.y}px`;
    }
  }

  getImageUrl(): string {
    if (!this.imovel || !this.imovel.codigo) return '/assets/images/no-image.jpg';
    // Usar a URL correta do endpoint de imagens com timestamp para evitar cache
    const timestamp = new Date().getTime();
    return `/api/imagens/${this.imovel.codigo}/?t=${timestamp}`;
  }

  onImageError(event: any): void {
    console.error(`❌ [DEBUG] Erro ao carregar imagem para imóvel ${this.imovel?.codigo}`);
    event.target.src = '/assets/images/no-image.jpg';
  }

  getEnderecoFormatado(): string {
    if (!this.imovel) return 'Endereço indisponível';
    
    const parts = [
      this.imovel.endereco,
      this.imovel.bairro,
      this.imovel.cidade,
      this.imovel.estado
    ].filter(part => !!part); // Remover partes vazias
    
    return parts.join(', ');
  }

  formatarValor(valor: string | number | undefined): string {
    if (valor === undefined || valor === null) return 'Valor não informado';
    const valorNumerico = Number(valor);
    if (isNaN(valorNumerico)) return 'Valor inválido';
    return valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarPorcentagem(valor: string | number | undefined): string {
    if (valor === undefined || valor === null) return '-';
    const valorNumerico = Number(valor);
    if (isNaN(valorNumerico)) return '-';
    // Assumindo que o valor já é a porcentagem (ex: 20 para 20%)
    return `${valorNumerico.toFixed(1)}%`; 
  }

  formatarArea(area: string | number | undefined): string {
    if (area === undefined || area === null) return 'Área não informada';
    const areaNumerica = Number(area);
    if (isNaN(areaNumerica)) return 'Área inválida';
    return `${areaNumerica.toFixed(2)} m²`;
  }

  onClose(): void {
    this.close.emit();
  }

  // Lógica para favoritar/desfavoritar
  onFavoritar(): void {
    if (!this.imovel || this.isTogglingFavorite) {
      return; // Ignora se não há imóvel ou se já está processando
    }

    if (!this.authService.isAuthenticated()) {
      this.snackBar.open('Você precisa estar logado para favoritar imóveis.', 'Fechar', { duration: 3000 });
      // Opcional: redirecionar para login
      // this.router.navigate(['/login']);
      return;
    }

    this.isTogglingFavorite = true; // Bloqueia cliques futuros
    const eraFavorito = this.isFavorito;

    this.favoritosService.toggleFavorito(this.imovel.codigo, this.imovel).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          // Sucesso real do backend, isFavorito já foi atualizado pelo BehaviorSubject
          this.snackBar.open(
            `Imóvel ${response.action === 'added' ? 'adicionado aos' : 'removido dos'} favoritos!`,
            'Fechar',
            { duration: 3000 }
          );
        } else {
          // Erro retornado pelo catchError do serviço (após reversão)
          this.snackBar.open(response.message || 'Falha ao sincronizar favorito.', 'Fechar', { duration: 4000 });
          // O estado isFavorito já foi revertido pelo serviço através do BehaviorSubject
        }
      },
      error: (err) => {
        // Erro na subscrição (raro, mas possível)
        console.error('Erro na subscrição do toggleFavorito:', err);
        this.snackBar.open('Erro inesperado ao processar favorito.', 'Fechar', { duration: 4000 });
        // Garante que isFavorito volte ao estado original se algo muito errado acontecer
        this.isFavorito = eraFavorito;
        this.cdr.detectChanges();
      },
      complete: () => {
        this.isTogglingFavorite = false; // Libera o botão
        this.cdr.detectChanges(); // Garante atualização da UI
      }
    });
  }
  
  // Navegar para detalhes
  onVerDetalhes(): void {
    if (this.imovel?.codigo) {
      this.router.navigate(['/propriedade', this.imovel.codigo]);
      this.onClose(); // Fechar info window ao navegar
    }
  }

  temDesconto(): boolean {
    if (!this.imovel || this.imovel.desconto === undefined || this.imovel.desconto === null) {
      return false;
    }
    const descontoNum = Number(this.imovel.desconto);
    return !isNaN(descontoNum) && descontoNum > 0;
  }
}

// Interface Input simplificada para o componente (se necessário)
export interface ImovelInfoWindowInput {
  imovel: Imovel;
  position: { x: number, y: number };
  map: google.maps.Map;
}
