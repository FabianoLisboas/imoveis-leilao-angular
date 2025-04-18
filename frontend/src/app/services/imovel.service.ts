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
    // 1. Criar objeto para armazenar parâmetros
    const paramsToSend: { [param: string]: string | number | boolean } = {
      page: page.toString(),
      page_size: pageSize.toString()
    };

    // Log explícito dos filtros iniciais
    console.log('Filtros recebidos no serviço:', JSON.stringify(filtros));
    console.log('Valores específicos:', {
      valor_min: filtros.valor_min,
      valorMin: filtros.valorMin,
      valor_max: filtros.valor_max,
      valorMax: filtros.valorMax,
      desconto_min: filtros.desconto_min,
      descontoMin: filtros.descontoMin
    });

    // 2. Adicionar filtros condicionalmente ao objeto
    if (filtros) {
      if (filtros.estado) {
        paramsToSend['estado'] = filtros.estado;
      }
      if (filtros.cidade) {
        paramsToSend['cidade'] = filtros.cidade;
      }
      if (filtros.bairro) {
        paramsToSend['bairro'] = filtros.bairro;
      }
      
      // Verificação mais detalhada para o tipo
      console.log('Valor de filtros.tipo_imovel:', filtros.tipo_imovel);
      console.log('Tipo de filtros.tipo_imovel:', typeof filtros.tipo_imovel);
      
      if (filtros.tipo_imovel != null && filtros.tipo_imovel !== '') {
        paramsToSend['tipo_imovel'] = filtros.tipo_imovel;
      }
      
      // Usar a verificação robusta para valores numéricos
      if (filtros.valor_min != null) {
        paramsToSend['valor_min'] = filtros.valor_min.toString();
      }
      if (filtros.valor_max != null) {
        paramsToSend['valor_max'] = filtros.valor_max.toString();
      }
      if (filtros.desconto_min != null) {
        paramsToSend['desconto_min'] = filtros.desconto_min.toString();
      }
    }

    // Log explícito dos parâmetros finais antes de criar o HttpParams
    console.log('Parâmetros a serem enviados:', JSON.stringify(paramsToSend));
    
    // 3. Criar HttpParams a partir do objeto final
    const queryParams = new HttpParams({ fromObject: paramsToSend });

    // Log dos parâmetros HTTP finais para comparar com o que vemos no console
    console.log('QueryParams resultado:', queryParams.toString());
    console.log('Parâmetros em formato de objeto:', Object.fromEntries([...queryParams.keys()].map(key => [key, queryParams.getAll(key)])));

    const cacheKey = `imoveis_${queryParams.toString()}`; // Cache key usa a string correta agora
    
    // Verificar cache
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTTL) {
      // console.log(`[ImovelService] Retornando do cache para: ${queryParams.toString()}`);
      return of(this.cache[cacheKey].data);
    }

    // Cancelar requisição anterior se existir
    this.cancelarRequisicaoAnterior(cacheKey);
    
    // Criar novo Subject para cancelamento
    const cancelToken = new Subject<void>();
    this.pendingRequests[cacheKey] = cancelToken;
    
    // DEBUG: Logar os parâmetros finais antes de enviar a requisição
    console.log(`[ImovelService] Enviando requisição com params: ${queryParams.toString()}`);
    
    return this.http.get<ApiResponse<Imovel>>(`${this.apiUrl}/propriedades/`, { 
      params: queryParams // Usar os HttpParams criados
    }).pipe(
      takeUntil(cancelToken),
      retry(1),
      tap(response => {
        // console.log(`[ImovelService] Armazenando no cache para: ${queryParams.toString()}`);
        this.cache[cacheKey] = {
          data: response,
          timestamp: Date.now()
        };
        // Remover após completar
        delete this.pendingRequests[cacheKey];
      }),
      catchError(error => {
        console.error(`[ImovelService] Erro na requisição para ${queryParams.toString()}:`, error);
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
    if (filtros.tipo_imovel != null && filtros.tipo_imovel !== '') {
      params.tipo_imovel = filtros.tipo_imovel;
    }
    if (filtros.valor_min != null) {
      params.valor_min = filtros.valor_min.toString();
    }
    if (filtros.valor_max != null) {
      params.valor_max = filtros.valor_max.toString();
    }
    if (filtros.desconto_min != null) {
      params.desconto_min = filtros.desconto_min.toString();
    }

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
