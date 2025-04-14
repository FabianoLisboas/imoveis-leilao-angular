import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GoogleMapsService {
  private loadingPromise: Promise<void> | null = null;
  private readonly apiKey = environment.googleMapsApiKey;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

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
    this.loadingPromise = new Promise<void>((resolve, reject) => {
      try {
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
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places&callback=initGoogleMaps`;
        
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

    return this.loadingPromise;
  }
}

// Adicionar a declaração para o TypeScript
declare global {
  interface Window {
    googleMapsLoaded: boolean;
    initGoogleMaps: () => void;
  }
} 