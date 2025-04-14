import { Component, OnInit, NgZone, PLATFORM_ID, Inject, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth/auth.service';

declare global {
  interface Window {
    google: any;
    googleAuthInitialized: boolean;
    onGoogleAuthInit: () => void;
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatSnackBarModule],
  template: `
    <div class="login-container">
      <h2>Entre com sua conta</h2>
      <p>Faça login para salvar seus imóveis favoritos e receber atualizações.</p>
      
      <div class="login-methods">
        <!-- Botão de login do Google será renderizado aqui -->
        <div #googleButtonContainer id="googleButton" class="google-button-container"></div>
        
        <div *ngIf="!googleSDKLoaded" class="loading-spinner">
          Carregando opções de login...
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 40px 20px;
      max-width: 500px;
      margin: 0 auto;
      text-align: center;
    }
    
    h2 {
      margin-bottom: 16px;
      color: #3f51b5;
    }
    
    p {
      margin-bottom: 32px;
      color: #666;
    }
    
    .login-methods {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }
    
    .google-button-container {
      margin-bottom: 16px;
      min-height: 40px;
      width: 100%;
      display: flex;
      justify-content: center;
    }
    
    .loading-spinner {
      padding: 10px;
      color: #666;
    }
  `]
})
export class LoginComponent implements OnInit, AfterViewInit {
  @ViewChild('googleButtonContainer') googleButtonContainer!: ElementRef;
  googleSDKLoaded = false;
  isBrowser: boolean;
  private googleClientId = '20613399478-okcgnkl9docadu2qrov4h3lr084jgthd.apps.googleusercontent.com';

  constructor(
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // Verificamos se já existe um usuário logado
    this.authService.currentUser.subscribe(user => {
      if (user) {
        // Se já estiver logado, redirecionamos para a página inicial
        this.router.navigate(['/']);
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.initializeGoogleSignIn();
    }
  }

  private initializeGoogleSignIn(): void {
    // Verificamos se o SDK do Google já está carregado
    const checkGoogleSDK = setInterval(() => {
      if (window.google && window.google.accounts) {
        clearInterval(checkGoogleSDK);
        this.renderGoogleButton();
        this.googleSDKLoaded = true;
      }
    }, 100);

    // Definimos um timeout para caso o SDK não carregue
    setTimeout(() => {
      clearInterval(checkGoogleSDK);
      if (!this.googleSDKLoaded) {
        console.error('Falha ao carregar o SDK do Google');
      }
    }, 10000);
  }

  private renderGoogleButton(): void {
    this.ngZone.run(() => {
      // Configuramos o botão do Google
      window.google.accounts.id.initialize({
        client_id: this.googleClientId,
        callback: this.handleGoogleResponse.bind(this),
        auto_select: false,
        cancel_on_tap_outside: true
      });

      // Renderizamos o botão
      window.google.accounts.id.renderButton(
        this.googleButtonContainer.nativeElement,
        { 
          theme: 'outline', 
          size: 'large',
          width: 320,
          type: 'standard',
          text: 'continuar_com',
          logo_alignment: 'center',
          locale: 'pt-BR'
        }
      );
    });
  }

  private handleGoogleResponse(response: any): void {
    this.ngZone.run(() => {
      // Enviamos o token ID para o backend
      this.authService.loginWithGoogle(response.credential).subscribe({
        next: (res) => {
          this.snackBar.open('Login realizado com sucesso!', 'Fechar', { duration: 3000 });
          this.router.navigate(['/']);
        },
        error: (err) => {
          console.error('Erro de autenticação:', err);
          this.snackBar.open('Erro ao fazer login. Tente novamente.', 'Fechar', { duration: 5000 });
        }
      });
    });
  }
} 