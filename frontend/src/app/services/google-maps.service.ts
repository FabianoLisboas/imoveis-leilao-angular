import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { environment } from '../../environments/environment';
import { switchMap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class GoogleMapsService {
  private loadingPromise: Promise<void> | null = null;
  private apiKey: string | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {}

  loadGoogleMaps(): Promise<void> {
    // Retorna imediatamente no caso de SSR (Server-Side Rendering)
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve();
    }

    // Se já estiver carregado, retorna a promessa existente
    if (window.googleMapsLoaded) {
      return Promise.resolve();
    }

    // Se já estiver carregando, retorna a promessa em andamento
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Carrega a API do Google Maps
    this.loadingPromise = this.getApiKey().then(key => {
      return new Promise<void>((resolve, reject) => {
        try {
          // Guarda a chave para uso futuro
          this.apiKey = key;
          
          // Primeiro, garante que a função de callback está definida globalmente
          window.initGoogleMaps = () => {
            console.log('Google Maps carregado com sucesso via callback');
            window.googleMapsLoaded = true;
          };
          
          // Cria o elemento de script
          const script = document.createElement('script');
          script.type = 'text/javascript';
          script.async = true;
          script.defer = true;
          script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=initGoogleMaps`;
          
          // Adiciona o script ao final do body
          document.body.appendChild(script);
          
          console.log('Script do Google Maps adicionado ao DOM');
          
          // Configura um temporizador para detectar falhas no carregamento
          const timeoutId = setTimeout(() => {
            if (!window.googleMapsLoaded) {
              console.error('Timeout ao carregar Google Maps API');
              document.getElementById('google-maps-error')?.style.setProperty('display', 'block');
              reject(new Error('Tempo limite excedido ao carregar o Google Maps'));
            }
          }, 15000); // 15 segundos de timeout
          
          // Observa a variável global que será definida quando a API estiver carregada
          const checkIfLoaded = () => {
            if (window.googleMapsLoaded) {
              console.log('Google Maps detectado como carregado');
              clearTimeout(timeoutId);
              resolve();
            } else {
              setTimeout(checkIfLoaded, 200);
            }
          };
          
          // Inicia a verificação
          checkIfLoaded();
        } catch (error) {
          console.error('Erro ao carregar Google Maps:', error);
          reject(error);
        }
      });
    });

    return this.loadingPromise;
  }

  /**
   * Obtém a chave de API do Google Maps do backend
   */
  private getApiKey(): Promise<string> {
    return this.http.get<{key: string}>('/api/config/maps-key/')
      .pipe(
        catchError(error => {
          console.error('Erro ao obter chave da API do Maps:', error);
          // Fallback para a chave do environment em caso de erro
          return from(Promise.resolve({ key: environment.googleMapsApiKey }));
        })
      )
      .toPromise()
      .then(response => response?.key || environment.googleMapsApiKey);
  }
}

// Adicionar a declaração para o TypeScript
declare global {
  interface Window {
    googleMapsLoaded: boolean;
    initGoogleMaps: () => void;
  }
} 