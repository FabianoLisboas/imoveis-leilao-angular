import { Component, OnInit, NgZone, PLATFORM_ID, Inject, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService, UserProfile } from '../../services/auth/auth.service';
import { FavoritosService } from '../../services/favoritos.service';

declare global {
  interface Window {
    google: any;
  }
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <mat-toolbar color="primary">
      <a routerLink="/" class="site-title">Imóveis Caixa</a>
      
      <div class="spacer"></div>
      
      <nav>
        <a mat-button routerLink="/imoveis" routerLinkActive="active-link">
          <mat-icon>list</mat-icon>
          Imóveis
        </a>
        <a mat-button routerLink="/mapa" routerLinkActive="active-link">
          <mat-icon>map</mat-icon>
          Mapa
        </a>
        
        <!-- Menu de favoritos (só aparece quando logado) -->
        <a mat-button routerLink="/favoritos" routerLinkActive="active-link" *ngIf="currentUser">
          <mat-icon>favorite</mat-icon>
          Favoritos
        </a>
        
        <!-- Botões de Login/Logout -->
        <ng-container *ngIf="!currentUser">
          <!-- Botão de Login do Google -->
          <div #googleButtonContainer id="googleButton" class="google-button-container"></div>
        </ng-container>
        
        <ng-container *ngIf="currentUser">
          <button mat-button [matMenuTriggerFor]="userMenu" class="user-menu-button">
            <div class="avatar-circle">
              {{ getInitials() }}
            </div>
            <span class="username">{{ getUserDisplayName() }}</span>
          </button>
          
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item routerLink="/favoritos">
              <mat-icon>favorite</mat-icon>
              <span>Meus Favoritos</span>
            </button>
            <button mat-menu-item (click)="logout()">
              <mat-icon>exit_to_app</mat-icon>
              <span>Sair</span>
            </button>
          </mat-menu>
        </ng-container>
      </nav>
    </mat-toolbar>
  `,
  styles: [`
    .mat-toolbar {
      display: flex;
      justify-content: space-between;
      padding: 0 16px;
    }
    
    .site-title {
      text-decoration: none;
      color: white;
      font-size: 1.5rem;
      font-weight: 500;
    }
    
    .spacer {
      flex: 1 1 auto;
    }
    
    nav {
      display: flex;
      align-items: center;
    }
    
    .active-link {
      background-color: rgba(255, 255, 255, 0.15);
    }
    
    .user-menu-button {
      display: flex;
      align-items: center;
    }
    
    .avatar-circle {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background-color: #f0f0f0;
      color: #3f51b5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      margin-right: 8px;
    }
    
    .username {
      margin-left: 8px;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .login-container {
      display: flex;
      align-items: center;
    }
    
    .google-button-container {
      height: 40px;
      transform: scale(0.85);
      overflow: hidden;
      display: inline-block;
    }
    
    .login-button {
      margin-left: 5px;
    }
    
    .login-fallback {
      display: none; /* Inicialmente oculto */
    }
    
    /* Mostrar o botão fallback após 3 segundos se o botão do Google não carregar */
    @media (max-width: 768px) {
      .username {
        display: none;
      }
      
      .google-button-container:empty + .login-fallback {
        display: flex;
      }
    }
  `]
})
export class HeaderComponent implements OnInit, AfterViewInit {
  @ViewChild('googleButtonContainer') googleButtonContainer!: ElementRef;
  currentUser: UserProfile | null = null;
  isBrowser: boolean;
  private googleClientId = '20613399478-okcgnkl9docadu2qrov4h3lr084jgthd.apps.googleusercontent.com';
  
  constructor(
    private authService: AuthService,
    private favoritosService: FavoritosService,
    private router: Router,
    private snackBar: MatSnackBar,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    console.log(`HeaderComponent - isBrowser: ${this.isBrowser}`);
  }
  
  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      const wasAuthenticated = this.currentUser !== null;
      this.currentUser = user;
      
      // Se o usuário está logado, carregar os favoritos
      if (user) {
        this.favoritosService.carregarFavoritos();
      } else if (wasAuthenticated) {
        // Se o usuário acabou de fazer logout, renderizar o botão do Google novamente
        setTimeout(() => {
          this.initGoogleSignIn();
        }, 100);
      }
    });
  }
  
  ngAfterViewInit(): void {
    // Inicializar o botão independente da detecção de plataforma
    if (!this.currentUser) {
      console.log('ngAfterViewInit: Inicializando botão Google...');
      
      // Adicionamos um pequeno atraso para garantir que o DOM esteja pronto
      setTimeout(() => {
        this.initGoogleSignIn();
      }, 500);
    }
  }
  
  // Inicializa o botão de login do Google
  private initGoogleSignIn(): void {
    // Temporariamente ignorando a verificação de isBrowser por conta de um bug na detecção
    // if (!this.isBrowser || this.currentUser) {
    if (this.currentUser) {
      return; // Não inicializar se o usuário estiver logado
    }
    
    console.log('Tentando inicializar botão do Google...');
    
    // Verificar se o containerElement está disponível
    if (!this.googleButtonContainer) {
      console.error('Elemento do botão Google não encontrado');
      return;
    }
    
    // Limpar o container caso já tenha algo renderizado
    this.googleButtonContainer.nativeElement.innerHTML = '';
    
    // Verificar se o objeto 'google' existe no escopo global
    if (typeof window !== 'undefined' && window.google && window.google.accounts) {
      console.log('SDK do Google já está disponível, renderizando botão');
      this.renderGoogleButton();
      return;
    }
    
    // Aguardar até que o SDK do Google esteja carregado
    console.log('Aguardando SDK do Google carregar...');
    const checkGoogleSDK = setInterval(() => {
      if (typeof window !== 'undefined' && window.google && window.google.accounts) {
        clearInterval(checkGoogleSDK);
        console.log('SDK do Google carregado, renderizando botão');
        this.renderGoogleButton();
      }
    }, 100);
    
    // Definir um timeout caso o SDK não carregue
    setTimeout(() => {
      clearInterval(checkGoogleSDK);
      console.log('Timeout ao aguardar SDK do Google');
    }, 5000);
  }
  
  // Renderiza o botão de login do Google
  private renderGoogleButton(): void {
    if (this.googleButtonContainer) {
      this.ngZone.run(() => {
        window.google.accounts.id.initialize({
          client_id: this.googleClientId,
          callback: this.handleGoogleSignIn.bind(this),
          auto_select: false,
          cancel_on_tap_outside: true
        });
        
        window.google.accounts.id.renderButton(
          this.googleButtonContainer.nativeElement,
          { 
            theme: 'outline', 
            size: 'medium',
            width: 180,
            type: 'standard',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'center',
            locale: 'pt-BR'
          }
        );
      });
    }
  }
  
  // Processa a resposta de autenticação do Google
  private handleGoogleSignIn(response: any): void {
    this.ngZone.run(() => {
      this.authService.loginWithGoogle(response.credential).subscribe({
        next: () => {
          this.snackBar.open('Login realizado com sucesso!', 'Fechar', { duration: 3000 });
        },
        error: (err) => {
          console.error('Erro de autenticação:', err);
          this.snackBar.open('Erro ao fazer login. Tente novamente.', 'Fechar', { duration: 5000 });
        }
      });
    });
  }
  
  // Obter iniciais do nome do usuário para o avatar
  getInitials(): string {
    if (!this.currentUser) return '';
    
    if (this.currentUser.nome) {
      return this.currentUser.nome.charAt(0).toUpperCase();
    } else if (this.currentUser.username) {
      return this.currentUser.username.charAt(0).toUpperCase();
    } else {
      return this.currentUser.email.charAt(0).toUpperCase();
    }
  }
  
  // Obter nome para exibição
  getUserDisplayName(): string {
    if (!this.currentUser) return '';
    
    return this.currentUser.nome || 
           this.currentUser.username || 
           this.currentUser.email.split('@')[0];
  }
  
  logout(): void {
    this.authService.logout().subscribe(() => {
      this.snackBar.open('Você foi desconectado com sucesso', 'Fechar', { duration: 3000 });
      this.router.navigate(['/']);
    });
  }
} 