import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay, of, Subject, throwError } from 'rxjs';
import { catchError, tap, takeUntil, retry } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Imovel, ApiResponse } from '../models/imovel';

@Injectable({
  providedIn: 'root'
})
export class ImovelService {
  private apiUrl = environment.apiUrl;
  private cache: { [key: string]: any } = {};
  private cacheTTL = 10 * 60 * 1000; // 10 minutos
  private pendingRequests: { [key: string]: Subject<void> } = {};

  constructor(private http: HttpClient) {}

  getImoveis(page: number = 1, pageSize: number = 10, filtros?: any): Observable<ApiResponse<Imovel>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
      
    // Adicionar filtros aos parâmetros
    let queryParams = params;
    if (filtros) {
      if (filtros.estado) queryParams = queryParams.set('estado', filtros.estado);
      if (filtros.cidade) queryParams = queryParams.set('cidade', filtros.cidade);
      if (filtros.bairro) queryParams = queryParams.set('bairro', filtros.bairro);
      if (filtros.tipo) queryParams = queryParams.set('tipo_imovel', filtros.tipo);
      if (filtros.valorMin) queryParams = queryParams.set('valor_min', filtros.valorMin);
      if (filtros.valorMax) queryParams = queryParams.set('valor_max', filtros.valorMax);
      if (filtros.descontoMin) queryParams = queryParams.set('desconto_min', filtros.descontoMin);
    }

    const cacheKey = `imoveis_${queryParams.toString()}`;
    
    // Verificar cache
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTTL) {
      return of(this.cache[cacheKey].data);
    }

    // Cancelar requisição anterior se existir
    this.cancelarRequisicaoAnterior(cacheKey);
    
    // Criar novo Subject para cancelamento
    const cancelToken = new Subject<void>();
    this.pendingRequests[cacheKey] = cancelToken;
    
    return this.http.get<ApiResponse<Imovel>>(`${this.apiUrl}/propriedades/`, { 
      params: queryParams
    }).pipe(
      takeUntil(cancelToken),
      retry(1),
      tap(response => {
        this.cache[cacheKey] = {
          data: response,
          timestamp: Date.now()
        };
        // Remover após completar
        delete this.pendingRequests[cacheKey];
      }),
      catchError(error => {
        delete this.pendingRequests[cacheKey];
        return throwError(() => error);
      })
    );
  }

  getImoveisParaMapa(filtros: any): Observable<any> {
    const params: any = {};
    
    if (filtros.estado) params.estado = filtros.estado;
    if (filtros.cidade) params.cidade = filtros.cidade;
    if (filtros.bairro) params.bairro = filtros.bairro;
    if (filtros.tipo) params.tipo_imovel = filtros.tipo;
    if (filtros.valorMax) params.valor_max = filtros.valorMax;
    if (filtros.descontoMin) params.desconto_min = filtros.descontoMin;

    const queryParams = new HttpParams({ fromObject: params });
    const cacheKey = `mapa_${queryParams.toString()}`;
    
    // Verificar cache
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTTL) {
      return of(this.cache[cacheKey].data);
    }

    // Cancelar requisição anterior se existir
    this.cancelarRequisicaoAnterior(cacheKey);
    
    // Criar novo Subject para cancelamento
    const cancelToken = new Subject<void>();
    this.pendingRequests[cacheKey] = cancelToken;

    return this.http.get(`${this.apiUrl}/mapa/`, { params }).pipe(
      takeUntil(cancelToken),
      retry(1),
      tap(response => {
        this.cache[cacheKey] = {
          data: response,
          timestamp: Date.now()
        };
        // Remover após completar
        delete this.pendingRequests[cacheKey];
      }),
      catchError(error => {
        delete this.pendingRequests[cacheKey];
        return throwError(() => error);
      })
    );
  }

  getImovel(codigo: string): Observable<Imovel> {
    const cacheKey = `imovel_${codigo}`;
    
    // Verificar cache
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTTL) {
      return of(this.cache[cacheKey].data);
    }

    return this.http.get<Imovel>(`${this.apiUrl}/propriedades/${codigo}/`).pipe(
      tap(response => {
        this.cache[cacheKey] = {
          data: response,
          timestamp: Date.now()
        };
      })
    );
  }

  getEstados(): Observable<string[]> {
    const cacheKey = 'estados';
    
    // Verificar cache
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTTL) {
      return of(this.cache[cacheKey].data);
    }

    return this.http.get<string[]>(`${this.apiUrl}/estados/`).pipe(
      tap(response => {
        this.cache[cacheKey] = {
          data: response,
          timestamp: Date.now()
        };
      }),
      shareReplay(1)
    );
  }

  getCidadesPorEstado(estado: string): Observable<string[]> {
    const cacheKey = `cidades_${estado}`;
    
    // Verificar cache
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTTL) {
      return of(this.cache[cacheKey].data);
    }

    return this.http.get<string[]>(`${this.apiUrl}/cidades/${estado}/`).pipe(
      tap(response => {
        this.cache[cacheKey] = {
          data: response,
          timestamp: Date.now()
        };
      }),
      shareReplay(1)
    );
  }

  getBairrosPorCidade(cidade: string): Observable<string[]> {
    const cacheKey = `bairros_${cidade}`;
    
    // Verificar cache
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTTL) {
      return of(this.cache[cacheKey].data);
    }

    return this.http.get<string[]>(`${this.apiUrl}/bairros/${cidade}/`).pipe(
      tap(response => {
        this.cache[cacheKey] = {
          data: response,
          timestamp: Date.now()
        };
      }),
      shareReplay(1)
    );
  }

  getTiposImovel(): Observable<string[]> {
    const cacheKey = 'tipos_imovel';
    
    // Verificar cache
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTTL) {
      return of(this.cache[cacheKey].data);
    }

    return this.http.get<string[]>(`${this.apiUrl}/tipos-imovel/`).pipe(
      tap(response => {
        this.cache[cacheKey] = {
          data: response,
          timestamp: Date.now()
        };
      }),
      shareReplay(1)
    );
  }

  getFavoritos(): Observable<Imovel[]> {
    return this.http.get<Imovel[]>(`${this.apiUrl}/usuarios/favoritos/`);
  }

  toggleFavorito(imovelId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/usuarios/favoritos/toggle/`, { imovel_id: imovelId });
  }

  limparCache(): void {
    this.cache = {};
  }

  private cancelarRequisicaoAnterior(cacheKey: string): void {
    if (this.pendingRequests[cacheKey]) {
      this.pendingRequests[cacheKey].next();
      this.pendingRequests[cacheKey].complete();
      delete this.pendingRequests[cacheKey];
    }
  }
}
