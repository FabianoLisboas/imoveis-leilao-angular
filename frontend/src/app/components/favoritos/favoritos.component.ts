import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { FavoritosService } from '../../services/favoritos.service';
import { AuthService } from '../../services/auth/auth.service';
import { Imovel } from '../../models/imovel';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';

/**
 * Componente para exibir e gerenciar imóveis favoritos
 */
@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule
  ],
  template: `
    <div class="favoritos-container">
      <h1 class="page-title">Meus Imóveis Favoritos</h1>

      <div class="loading-container" *ngIf="carregando">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Carregando seus favoritos...</p>
      </div>

      <div class="empty-state" *ngIf="!carregando && (!imoveis || imoveis.length === 0)">
        <mat-icon class="empty-icon">favorite_border</mat-icon>
        <h2>Você ainda não tem favoritos</h2>
        <p>Navegue pelos imóveis e clique no coração para adicionar aos favoritos</p>
        <button mat-raised-button color="primary" routerLink="/mapa">
          <mat-icon>map</mat-icon>
          Explorar Imóveis no Mapa
        </button>
      </div>

      <div class="favoritos-grid" *ngIf="!carregando && imoveis && imoveis.length > 0">
        <mat-card *ngFor="let imovel of imoveis" class="imovel-card">
          <div class="card-image-container">
            <img 
              [src]="getImagemUrl(imovel)" 
              [alt]="imovel.tipo_imovel" 
              class="card-image"
              (error)="onImageError($event)"
            >
          </div>
          
          <mat-card-content>
            <h2 class="imovel-tipo">{{imovel.tipo_imovel}}</h2>
            <p class="imovel-endereco">
              {{imovel.endereco}}
              <br>
              {{imovel.bairro ? imovel.bairro + ', ' : ''}}{{imovel.cidade}} - {{imovel.estado}}
            </p>
            
            <div class="imovel-preco">
              <p class="preco-texto">R$ {{formatarValor(imovel.valor)}}</p>
              <span *ngIf="imovel.desconto" class="desconto-badge">{{imovel.desconto}}% OFF</span>
            </div>
            
            <mat-divider class="card-divider"></mat-divider>
            
            <div class="card-actions">
              <button mat-stroked-button color="primary" [routerLink]="['/propriedade', imovel.codigo]">
                <mat-icon>search</mat-icon>
                Ver Detalhes
              </button>
              
              <button mat-icon-button color="warn" (click)="removerFavorito(imovel)" matTooltip="Remover dos favoritos">
                <mat-icon>favorite</mat-icon>
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .favoritos-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }
    
    .page-title {
      margin-bottom: 32px;
      color: #3f51b5;
      font-weight: 500;
    }
    
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 0;
    }
    
    .loading-container p {
      margin-top: 16px;
      color: #666;
    }
    
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 0;
      text-align: center;
    }
    
    .empty-icon {
      font-size: 64px;
      height: 64px;
      width: 64px;
      color: #ccc;
      margin-bottom: 16px;
    }
    
    .empty-state h2 {
      color: #333;
      margin-bottom: 8px;
    }
    
    .empty-state p {
      color: #666;
      margin-bottom: 24px;
      max-width: 400px;
    }
    
    .favoritos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }
    
    .imovel-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .imovel-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }
    
    .card-image-container {
      height: 180px;
      overflow: hidden;
    }
    
    .card-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .imovel-tipo {
      font-size: 18px;
      font-weight: 500;
      margin: 16px 0 8px;
      color: #333;
    }
    
    .imovel-endereco {
      color: #666;
      margin-bottom: 16px;
      line-height: 1.4;
    }
    
    .imovel-preco {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .preco-texto {
      font-size: 18px;
      font-weight: 500;
      color: #3f51b5;
      margin: 0;
    }
    
    .desconto-badge {
      background-color: #4caf50;
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      margin-left: 8px;
    }
    
    .card-divider {
      margin: 8px 0 16px;
    }
    
    .card-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
    }
  `]
})
export class FavoritosComponent implements OnInit, OnDestroy {
  imoveis: Imovel[] = [];
  carregando = true;
  private favoritosSubscription?: Subscription;
  private imoveisRemovidos: string[] = [];
  
  // Controle de autenticação
  usuarioAutenticado = false;
  
  constructor(
    private favoritosService: FavoritosService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {}
  
  ngOnInit(): void {
    // Verificar autenticação
    this.usuarioAutenticado = this.authService.isAuthenticated();
    
    // Se não estiver autenticado, não carregar favoritos
    if (!this.usuarioAutenticado) {
      this.carregando = false;
      return;
    }
    
    // Carregar favoritos do backend
    this.carregarFavoritos();
  }
  
  ngOnDestroy(): void {
    if (this.favoritosSubscription) {
      this.favoritosSubscription.unsubscribe();
    }
  }
  
  // Navegar para a página de detalhes do imóvel
  verDetalhes(codigo: string): void {
    this.router.navigate(['/imovel', codigo]);
  }
  
  // Formatar valor monetário
  formatarValor(valor: any): string {
    if (!valor) return 'Valor não informado';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  
  // Tratar erro na imagem
  onImageError(event: any): void {
    event.target.src = '/assets/images/no-image.jpg';
  }
  
  // Obter URL da imagem do imóvel
  getImagemUrl(imovel: Imovel): string {
    if (!imovel || !imovel.codigo) return '/assets/images/no-image.jpg';
    // Usar a URL correta com timestamp para evitar cache
    const timestamp = new Date().getTime();
    return `/api/imagens/${imovel.codigo}/?t=${timestamp}`;
  }
  
  // Fazer login
  fazerLogin(): void {
    this.router.navigate(['/login']);
  }
  
  // Carregar favoritos do backend
  carregarFavoritos(): void {
    this.carregando = true;
    
    // Usar o método getFavoritosCompletos que retorna dados do backend
    this.favoritosService.getFavoritosCompletos().subscribe({
      next: (imoveis) => {
        // Guardar lista de imóveis
        this.imoveis = imoveis;
        this.carregando = false;
      },
      error: (error) => {
        console.error('Erro ao carregar favoritos:', error);
        this.carregando = false;
        this.snackBar.open('Erro ao carregar favoritos', 'Fechar', { duration: 5000 });
      }
    });
  }
  
  // Remover um imóvel dos favoritos
  removerFavorito(imovel: Imovel): void {
    if (!imovel || !imovel.codigo) {
      console.error('Tentativa de remover favorito inválido');
      return;
    }
    
    // Mostrar feedback imediato
    this.snackBar.open('Removendo dos favoritos...', '', { duration: 500 });
    
    // Remover imediatamente da lista local para feedback instantâneo
    this.imoveis = this.imoveis.filter(i => i.codigo !== imovel.codigo);
    
    // Chamar o serviço para remover do backend
    this.favoritosService.toggleFavorito(imovel.codigo).subscribe({
      next: (resultado) => {
        // Feedback de sucesso
        this.snackBar.open('Imóvel removido dos favoritos', 'Fechar', { duration: 3000 });
      },
      error: (error) => {
        console.error('Erro ao remover favorito:', error);
        
        if (error.status === 401) {
          this.snackBar.open('Você precisa estar logado para gerenciar favoritos', 'Fechar', { duration: 5000 });
          this.router.navigate(['/login']);
        } else {
          this.snackBar.open('Erro ao remover dos favoritos', 'Fechar', { duration: 5000 });
        }
      }
    });
  }
} 