import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { Imovel } from '../models/imovel';
import { AuthService } from './auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class FavoritosService {
  private apiUrl = '/api/usuarios/favoritos/';
  private favoritosSubject = new BehaviorSubject<string[]>([]);
  public favoritos = this.favoritosSubject.asObservable();
  
  // Map para armazenar dados completos dos imóveis favoritos
  private imoveisFavoritosMap = new Map<string, Imovel>();
  
  // Verificar se estamos no browser
  private isBrowser: boolean;
  
  constructor(
    private http: HttpClient,
    private authService: AuthService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Carregar favoritos iniciais
    this.carregarFavoritos();
  }
  
  // Carregar a lista de favoritos da API ou localStorage
  public carregarFavoritos(): void {
    // Verificar se o usuário está autenticado
    if (this.authService.isAuthenticated()) {
      // Carregar favoritos da API
      this.getFavoritosCompletos().subscribe();
    } else if (this.isBrowser) {
      // Carregar favoritos do localStorage se não estiver autenticado
      this.carregarFavoritosLocalStorage();
    }
  }
  
  // Carregar favoritos do localStorage
  private carregarFavoritosLocalStorage(): void {
    if (this.isBrowser) {
      try {
        // Carregar lista de códigos
        const favoritosJson = localStorage.getItem('favoritos');
        if (favoritosJson) {
          const favoritos = JSON.parse(favoritosJson);
          this.favoritosSubject.next(favoritos);
        }
        
        // Carregar dados completos dos imóveis
        const dadosJson = localStorage.getItem('favoritos_dados');
        if (dadosJson) {
          const dados = JSON.parse(dadosJson);
          Object.entries(dados).forEach(([codigo, imovel]) => {
            this.imoveisFavoritosMap.set(codigo, imovel as Imovel);
          });
        }
      } catch (e) {
        console.error('Erro ao carregar favoritos do localStorage:', e);
      }
    }
  }
  
  // Verificar se um imóvel é favorito
  isFavorito(codigoImovel: string): boolean {
    return this.favoritosSubject.value.includes(codigoImovel);
  }
  
  // Adicionar dados completos de um imóvel
  addImovelData(imovel: Imovel): void {
    if (imovel && imovel.codigo) {
      this.imoveisFavoritosMap.set(imovel.codigo, imovel);
      
      // Atualizar o localStorage
      if (this.isBrowser) {
        const imoveisObject = Object.fromEntries(this.imoveisFavoritosMap);
        localStorage.setItem('favoritos_dados', JSON.stringify(imoveisObject));
      }
    }
  }
  
  // Alternar (adicionar/remover) favorito - funcionará apenas para usuários autenticados
  toggleFavorito(codigoImovel: string, imovelCompleto?: Imovel): Observable<any> {
    // API precisa de barra no final para Django: /api/usuarios/favoritos/{codigo}/
    const apiEndpoint = `${this.apiUrl}${codigoImovel}/`;
    
    // Guardar o estado atual para possível reversão em caso de erro
    const estadoAnterior = [...this.favoritosSubject.value];
    const mapaAnterior = new Map(this.imoveisFavoritosMap);
    const eraFavorito = estadoAnterior.includes(codigoImovel);

    // Atualização otimista da UI (pode ser revertida)
    const novosFavoritos = [...estadoAnterior];
    const index = novosFavoritos.indexOf(codigoImovel);
    
    if (index === -1) {
      // Adicionar otimista
      novosFavoritos.push(codigoImovel);
      if (imovelCompleto) {
        this.imoveisFavoritosMap.set(codigoImovel, imovelCompleto);
      }
    } else {
      // Remover otimista
      novosFavoritos.splice(index, 1);
      this.imoveisFavoritosMap.delete(codigoImovel);
    }
    this.favoritosSubject.next(novosFavoritos); // Notificar UI imediatamente
    
    // Enviar requisição ao backend
    return this.http.post(apiEndpoint, {}, { 
      withCredentials: true,
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      tap(response => {
        // Sucesso: Ação confirmada pelo backend
        console.log(`Favorito ${eraFavorito ? 'removido' : 'adicionado'} com sucesso no servidor:`, response);
        
        // A atualização otimista estava correta, apenas atualizamos o localStorage
        if (this.isBrowser) {
          localStorage.setItem('favoritos', JSON.stringify(this.favoritosSubject.value));
          const imoveisObject = Object.fromEntries(this.imoveisFavoritosMap);
          localStorage.setItem('favoritos_dados', JSON.stringify(imoveisObject));
        }
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Erro ao alternar favorito no servidor:', error);
        
        // *** REVERTER A ATUALIZAÇÃO OTIMISTA ***
        console.warn('Revertendo alteração local devido a erro no servidor.');
        this.favoritosSubject.next(estadoAnterior);
        this.imoveisFavoritosMap = mapaAnterior;
        // Não atualizar localStorage pois a operação falhou
        
        if (error.status === 0 || error.status >= 500) {
            console.error('Erro de conexão ou erro no servidor. Verifique se o backend está rodando.');
            // Poderia exibir uma mensagem específica para o usuário aqui
        } else if (error.status === 401) {
          console.error('Usuário não está autenticado. Faça login para gerenciar favoritos.');
        } else if (error.status === 404) {
          console.error('Imóvel não encontrado no backend.');
        } else if (error.status === 400) {
          console.error('Erro nos dados enviados ou perfil não encontrado.');
        }
        
        // Retornar um erro para que o componente possa tratar se necessário
        return of({ status: 'error', message: error.error?.message || 'Falha ao sincronizar favorito com o servidor' });
      })
    );
  }
  
  // Obter a lista completa de imóveis favoritos
  getFavoritosCompletos(): Observable<Imovel[]> {
    // Se não estiver autenticado, retornar lista vazia
    if (!this.authService.isAuthenticated()) {
      console.log('Usuário não autenticado. Retornando lista vazia de favoritos.');
      return of([]);
    }
    
    // Obter favoritos da API
    return this.http.get<any>(this.apiUrl, { withCredentials: true }).pipe(
      map(response => {
        const favoritos = response.favoritos || [];
        
        // Atualizar o cache local com os dados completos
        favoritos.forEach((imovel: Imovel) => {
          if (imovel && imovel.codigo) {
            this.imoveisFavoritosMap.set(imovel.codigo, imovel);
          }
        });
        
        // Atualizar a lista de códigos de favoritos
        const codigos = favoritos.map((imovel: Imovel) => imovel.codigo);
        this.favoritosSubject.next(codigos);
        
        // Atualizar backup no localStorage
        if (this.isBrowser) {
          localStorage.setItem('favoritos', JSON.stringify(codigos));
          const imoveisObject = Object.fromEntries(this.imoveisFavoritosMap);
          localStorage.setItem('favoritos_dados', JSON.stringify(imoveisObject));
        }
        
        return favoritos;
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          console.log('Usuário não autenticado. Retornando lista vazia de favoritos.');
        } else {
          console.error('Erro ao obter imóveis favoritos:', error);
        }
        
        // Em caso de erro, retornar lista vazia
        return of([]);
      })
    );
  }
  
  // Método para obter um imóvel favorito específico pelos dados completos
  getFavoritoByCode(codigo: string): Imovel | null {
    return this.imoveisFavoritosMap.get(codigo) || null;
  }
} 