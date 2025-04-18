import { Component, OnInit, OnDestroy, ViewChild, PLATFORM_ID, Inject, ViewContainerRef, ComponentRef, ComponentFactoryResolver, ApplicationRef, Injector, EmbeddedViewRef, NgZone, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleMapsModule, GoogleMap, MapMarker } from '@angular/google-maps';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ImovelService } from '../../services/imovel.service';
import { Imovel, Endereco } from '../../models/imovel';
import { FavoritosService } from '../../services/favoritos.service';
import { AuthService } from '../../services/auth/auth.service';
import { GoogleMapsService } from '../../services/google-maps.service';
import { ImovelInfoWindowComponent } from '../imovel-info-window/imovel-info-window.component';
import { Router } from '@angular/router';

// Definição para o MarkerClusterer carregado via CDN
declare global {
  interface Window {
    markerClusterer: any;
    googleMapsLoaded: boolean;
    toggleFavorite: (codigo: string) => void;
  }
}

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GoogleMapsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    ImovelInfoWindowComponent
  ],
  template: `
    <div class="mapa-container">
      <!-- Filtros -->
      <div class="filtros-container">
        <h2>Filtros de Busca</h2>
        
        <mat-form-field>
            <mat-label>Estado</mat-label>
          <mat-select [(ngModel)]="filtros.estado" (selectionChange)="onEstadoChange()">
            <mat-option [value]="">Todos</mat-option>
              <mat-option *ngFor="let estado of estados" [value]="estado">
              {{estado}}
              </mat-option>
            </mat-select>
          </mat-form-field>

        <mat-form-field>
            <mat-label>Cidade</mat-label>
          <mat-select [(ngModel)]="filtros.cidade" (selectionChange)="onCidadeChange()" [disabled]="!filtros.estado">
            <mat-option [value]="">Todas</mat-option>
            <mat-option *ngFor="let cidade of cidades" [value]="cidade">
              {{cidade}}
            </mat-option>
          </mat-select>
          </mat-form-field>

        <mat-form-field>
            <mat-label>Bairro</mat-label>
          <mat-select [(ngModel)]="filtros.bairro" [disabled]="!filtros.cidade">
            <mat-option [value]="">Todos</mat-option>
            <mat-option *ngFor="let bairro of bairros" [value]="bairro">
              {{bairro}}
            </mat-option>
          </mat-select>
          </mat-form-field>

        <mat-form-field>
            <mat-label>Tipo de Imóvel</mat-label>
          <mat-select [(ngModel)]="filtros.tipo">
            <mat-option [value]="">Todos</mat-option>
            <mat-option *ngFor="let tipo of tiposImovel" [value]="tipo">
              {{tipo}}
            </mat-option>
            </mat-select>
          </mat-form-field>

        <mat-form-field>
            <mat-label>Valor Mínimo</mat-label>
          <input matInput type="number" [(ngModel)]="filtros.valorMin">
          </mat-form-field>

        <mat-form-field>
            <mat-label>Valor Máximo</mat-label>
          <input matInput type="number" [(ngModel)]="filtros.valorMax">
          </mat-form-field>

        <mat-form-field>
            <mat-label>Desconto Mínimo (%)</mat-label>
          <input matInput type="number" [(ngModel)]="filtros.descontoMin">
          </mat-form-field>

        <div class="botoes-container">
          <button mat-raised-button color="primary" (click)="aplicarFiltros()" [disabled]="carregando">
            <mat-icon>search</mat-icon>
            Buscar Imóveis
          </button>
          
          <button mat-button (click)="limparFiltros()" [disabled]="carregando">
            <mat-icon>clear</mat-icon>
            Limpar Filtros
          </button>
        </div>
        
        <div *ngIf="imoveisFiltrados.length > 0" class="contador-container">
          <div class="contador-chip">
            {{imoveisFiltrados.length}} de {{imoveis.length}} imóveis mostrados
          </div>
        </div>
        
        <div *ngIf="!googleMapsLoaded" class="maps-status-container">
          <div class="status-message warning">
            <mat-icon>info</mat-icon>
            Aguardando carregamento do Google Maps...
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div class="loading-overlay" *ngIf="carregando">
        <mat-spinner></mat-spinner>
      </div>

      <!-- Container de mapa/fallback -->
      <div class="map-container">
        <!-- Mapa - Apenas exibir quando estiver carregado -->
          <google-map
          *ngIf="googleMapsLoaded"
          height="100%"
            width="100%"
            [center]="center"
          [zoom]="zoom">
          </google-map>
        
        <!-- Placeholder enquanto o mapa carrega -->
        <div class="map-placeholder" *ngIf="!googleMapsLoaded && !carregando">
          <div class="loading-placeholder">
            <mat-spinner diameter="60"></mat-spinner>
            <p>Carregando Mapa de Imóveis...</p>
            <p class="subtext">Isso pode levar alguns segundos.</p>
        </div>
        </div>
        
        <!-- Erro do Google Maps -->
        <div class="map-error" *ngIf="isBrowser && !googleMapsLoaded && !carregando">
          <div class="error-card">
            <mat-icon class="error-icon">error</mat-icon>
            <h2>Não foi possível carregar o Google Maps</h2>
            <p>Verifique sua conexão com a internet e tente novamente.</p>
            <button mat-raised-button color="primary" (click)="recarregarPagina()">
              <mat-icon>refresh</mat-icon>
              Recarregar Página
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mapa-container {
      display: flex;
      height: calc(100vh - 64px); /* Ajustar para altura da barra de navegação */
      width: 100%;
      position: relative;
    }

    .filtros-container {
      width: 300px;
      padding: 20px;
      background-color: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      z-index: 1;
      overflow-y: auto;
    }
    
    .filtros-container h2 {
      margin-top: 0;
      margin-bottom: 20px;
      color: #3f51b5;
      font-weight: 500;
    }

    .filtros-container mat-form-field {
      width: 100%;
      margin-bottom: 10px;
    }

    .botoes-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 20px;
    }

    .botoes-container button {
      width: 100%;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2;
    }

    .map-container {
      flex: 1;
      position: relative;
      background-color: #f5f5f5;
    }

    google-map {
      height: 100%;
      width: 100%;
    }
    
    .map-placeholder {
      height: 100%;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f5f5f5;
    }
    
    .loading-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    
    .loading-placeholder p {
      margin-top: 16px;
      font-size: 18px;
      color: #555;
    }
    
    .loading-placeholder .subtext {
      font-size: 14px;
      color: #777;
      margin-top: 5px;
    }
    
    .contador-container {
      margin-top: 16px;
      display: flex;
      justify-content: center;
    }

    .contador-chip {
      background-color: #3f51b5;
      color: white;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 14px;
      text-align: center;
    }
    
    .maps-status-container {
      margin-top: 16px;
    }
    
    .status-message {
      padding: 10px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      font-size: 14px;
    }
    
    .status-message.warning {
      background-color: #fff3e0;
      color: #e65100;
    }
    
    .status-message mat-icon {
      margin-right: 8px;
      font-size: 20px;
    }

    .map-error {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f5f5f5;
      z-index: 1;
    }
    
    .error-card {
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
    }
    
    .error-icon {
      font-size: 48px;
      height: 48px;
      width: 48px;
      color: #f44336;
      margin-bottom: 16px;
    }
    
    .error-card h2 {
      margin: 0 0 16px;
      color: #333;
    }
    
    .error-card p {
      margin: 0 0 24px;
      color: #666;
    }
  `]
})
export class MapaComponent implements OnInit, OnDestroy {
  @ViewChild(GoogleMap) map!: GoogleMap;
  
  imoveis: Imovel[] = [];
  imoveisFiltrados: Imovel[] = [];
  estados: string[] = [];
  cidades: string[] = [];
  bairros: string[] = [];
  tiposImovel: string[] = [];
  carregando = false;
  googleMapsLoaded = false;
  public isBrowser: boolean;
  private debounceTimer: any;
  private maxMarcadoresPorLote = 100;
  private marcadoresCarregados = 0;
  private clusterManager: any;
  private infoWindowAtual: google.maps.InfoWindow | null = null;
  private directionsService: google.maps.DirectionsService | null = null;
  private directionsRenderer: google.maps.DirectionsRenderer | null = null;
  private rotaAtiva: boolean = false;
  private userAuthenticated = false;
  private infoWindowComponentRef: ComponentRef<ImovelInfoWindowComponent> | null = null;
  private overlay: google.maps.OverlayView | null = null;
  private mapMoveListener: google.maps.MapsEventListener | null = null;
  private infoWindowOpenListener: google.maps.MapsEventListener | null = null;
  
  center: google.maps.LatLngLiteral = {
    lat: -15.7801,
    lng: -47.9292
  };
  
  zoom = 4;

  filtros = {
    estado: '',
    cidade: '',
    bairro: '',
    tipo: '',
    valorMin: null as number | null,
    valorMax: null as number | null,
    descontoMin: null as number | null
  };

  constructor(
    private imovelService: ImovelService,
    private favoritosService: FavoritosService,
    private authService: AuthService,
    private googleMapsService: GoogleMapsService,
    private snackBar: MatSnackBar,
    @Inject(PLATFORM_ID) private platformId: Object,
    private viewContainerRef: ViewContainerRef,
    private componentFactoryResolver: ComponentFactoryResolver,
    private applicationRef: ApplicationRef,
    private injector: Injector,
    private router: Router,
    private ngZone: NgZone,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    console.log('Is Browser:', this.isBrowser);
    
    // Só inicializar valores padrão no browser
    if (this.isBrowser) {
      // Definir valores padrão
      this.limparFiltros();
      
      // Iniciar carregamento de dados mesmo sem o Google Maps
      setTimeout(() => {
        this.carregarEstados();
        this.carregarTiposImovel();
      }, 0);

      // Verificar se o usuário está autenticado
      this.authService.currentUser.subscribe(user => {
        this.userAuthenticated = !!user;
      });
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isBrowser = true;
      
      // Carregar Google Maps via serviço
      this.googleMapsService.loadGoogleMaps()
        .then(() => {
          this.googleMapsLoaded = true;
          this.configurarMapa();
          this.changeDetectorRef.detectChanges();
        })
        .catch(error => {
          console.error('Erro ao carregar Google Maps:', error);
          document.getElementById('google-maps-error')?.style.setProperty('display', 'block');
        });
    }
    
    // Inicializar dados
    this.carregarImoveis();
    this.carregarEstados();
    this.carregarTiposImovel();
    
    // Verificar autenticação do usuário
    this.userAuthenticated = this.authService.isAuthenticated();
    
    // Configurar função global para toggle de favoritos
    if (isPlatformBrowser(this.platformId)) {
      window.toggleFavorite = (codigo: string) => {
        this.ngZone.run(() => {
          const imovel = this.imoveis.find(i => i.codigo === codigo);
          if (imovel) {
            this.toggleFavorito(imovel);
          }
        });
      };
    }
  }

  carregarImoveis(): void {
    this.carregando = true;
    this.imovelService.getImoveisParaMapa({}).subscribe({
      next: (response: any) => {
        // Verificar se a resposta tem a propriedade 'results'
        if (response && response.results) {
          this.imoveis = response.results;
          this.imoveisFiltrados = [...response.results];
        } else {
          // Caso a resposta seja um array direto
          this.imoveis = Array.isArray(response) ? response : [];
          this.imoveisFiltrados = [...this.imoveis];
        }
        
        this.carregando = false;
        
        // Se o mapa já estiver carregado, atualizar os marcadores
        if (this.googleMapsLoaded && this.map) {
          this.atualizarMarcadores();
        }
      },
      error: (error) => {
        console.error('Erro ao carregar imóveis:', error);
        this.carregando = false;
        this.snackBar.open('Erro ao carregar imóveis. Tente novamente mais tarde.', 'Fechar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  configurarMapa(): void {
    if (!this.map?.googleMap) {
      console.error('Elemento do mapa não está disponível para configuração');
      
      // Tentar novamente após um curto atraso
      setTimeout(() => {
        if (this.map?.googleMap) {
          this.configurarMapaInterno();
        } else {
          this.snackBar.open('Não foi possível inicializar o mapa. Tente recarregar a página.', 'Recarregar', {
            duration: 10000
          }).onAction().subscribe(() => {
            window.location.reload();
          });
        }
      }, 1000);
      return;
    }
    
    this.configurarMapaInterno();
  }
  
  private configurarMapaInterno(): void {
    try {
      // Adicionar evento para carregar mais marcadores ao mover o mapa
      this.map?.googleMap?.addListener('idle', () => {
        this.carregarMarcadoresVisiveis();
      });
      
      // Configurar zoom para melhor visibilidade
      this.map?.googleMap?.setOptions({
        minZoom: 3,
        maxZoom: 18,
        fullscreenControl: true,
        mapTypeControl: true,
        streetViewControl: true,
        gestureHandling: 'cooperative',
        mapTypeId: google.maps.MapTypeId.ROADMAP
      });
      
      // Inicializar serviços de direções
      this.directionsService = new google.maps.DirectionsService();
      this.directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true, // Não mostrar marcadores padrão para não sobrepor os nossos
        polylineOptions: {
          strokeColor: '#4285F4',
          strokeWeight: 5,
          strokeOpacity: 0.8
        }
      });
      
      // Configurar evento de erro
      this.map?.googleMap?.addListener('error', () => {
        console.error('Erro interno do Google Maps');
        this.snackBar.open('Ocorreu um erro no mapa. Tente recarregar a página.', 'Recarregar', {
          duration: 10000
        }).onAction().subscribe(() => {
          window.location.reload();
        });
      });
    } catch (error) {
      console.error('Erro ao configurar mapa:', error);
      this.snackBar.open('Erro ao configurar o mapa. Tente recarregar a página.', 'Recarregar', {
        duration: 10000
      }).onAction().subscribe(() => {
        window.location.reload();
      });
    }
  }

  carregarEstados(): void {
    this.imovelService.getEstados().subscribe({
      next: (estados: string[]) => {
        this.estados = estados;
      },
      error: (error: any) => {
        console.error('Erro ao carregar estados:', error);
        this.snackBar.open('Erro ao carregar estados', 'Fechar', { duration: 3000 });
      }
    });
  }

  carregarTiposImovel(): void {
    this.imovelService.getTiposImovel().subscribe({
      next: (tipos: string[]) => {
        this.tiposImovel = tipos;
      },
      error: (error: any) => {
        console.error('Erro ao carregar tipos de imóvel:', error);
        this.snackBar.open('Erro ao carregar tipos de imóvel', 'Fechar', { duration: 3000 });
      }
    });
  }

  onEstadoChange() {
    this.filtros.cidade = '';
    this.filtros.bairro = '';
    this.cidades = [];
    this.bairros = [];
    
    if (this.filtros.estado) {
      this.imovelService.getCidadesPorEstado(this.filtros.estado).subscribe({
        next: (cidades: string[]) => {
          this.cidades = cidades;
        },
        error: (error: any) => {
          console.error('Erro ao carregar cidades:', error);
          this.snackBar.open('Erro ao carregar cidades', 'Fechar', { duration: 3000 });
        }
      });
    }
    
    // Aplicar filtros com debounce
    this.aplicarFiltrosComDebounce();
  }

  onCidadeChange() {
    this.filtros.bairro = '';
    this.bairros = [];
    
    if (this.filtros.cidade) {
      this.imovelService.getBairrosPorCidade(this.filtros.cidade).subscribe({
        next: (bairros: string[]) => {
          this.bairros = bairros;
        },
        error: (error: any) => {
          console.error('Erro ao carregar bairros:', error);
          this.snackBar.open('Erro ao carregar bairros', 'Fechar', { duration: 3000 });
        }
      });
    }
    
    // Aplicar filtros com debounce
    this.aplicarFiltrosComDebounce();
  }

  aplicarFiltrosComDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.aplicarFiltros();
    }, 300); // 300ms de debounce
  }

  aplicarFiltros(): void {
    // Verificar se há filtros selecionados
    const temFiltros = this.filtros.estado || 
                       this.filtros.cidade || 
                       this.filtros.bairro || 
                       this.filtros.tipo || 
                       this.filtros.valorMin ||
                       this.filtros.valorMax || 
                       this.filtros.descontoMin;
    
    if (!temFiltros) {
      this.snackBar.open('Selecione ao menos um filtro', 'Fechar', { duration: 3000 });
      return;
    }
    
    this.carregando = true;
    this.limparMarcadores();
    this.marcadoresCarregados = 0;
    
    // Construir objeto de filtros para a API - similar ao componente da lista
    const filtrosApi: Record<string, any> = {};
    if (this.filtros.estado) filtrosApi['estado'] = this.filtros.estado;
    if (this.filtros.cidade) filtrosApi['cidade'] = this.filtros.cidade;
    if (this.filtros.bairro) filtrosApi['bairro'] = this.filtros.bairro;
    if (this.filtros.tipo) filtrosApi['tipo_imovel'] = this.filtros.tipo;
    // Garantir que os valores numéricos são tratados corretamente
    if (this.filtros.valorMin != null) filtrosApi['valor_min'] = this.filtros.valorMin;
    if (this.filtros.valorMax != null) filtrosApi['valor_max'] = this.filtros.valorMax;
    if (this.filtros.descontoMin != null) filtrosApi['desconto_min'] = this.filtros.descontoMin;
    
    console.log('Mapa - Aplicando filtros:', filtrosApi);
    
    this.imovelService.getImoveisParaMapa(filtrosApi).subscribe({
      next: (response: any) => {
        this.imoveis = response.results;
        this.imoveisFiltrados = [];
        
        // Carregar primeiros marcadores
        this.carregarProximoLoteMarcadores();
        
        this.carregando = false;
        
        if (this.imoveis.length === 0) {
          this.snackBar.open('Nenhum imóvel encontrado com os filtros selecionados', 'Fechar', { duration: 3000 });
        } else {
          this.snackBar.open(`${response.count} imóveis encontrados`, 'Fechar', { duration: 2000 });
        }
      },
      error: (error: any) => {
        console.error('Erro ao aplicar filtros:', error);
        this.snackBar.open('Erro ao buscar imóveis', 'Fechar', { duration: 3000 });
        this.carregando = false;
      }
    });
  }

  carregarProximoLoteMarcadores(): void {
    if (!this.imoveis || this.marcadoresCarregados >= this.imoveis.length) {
      return;
    }
    
    const fimIndice = Math.min(this.marcadoresCarregados + this.maxMarcadoresPorLote, this.imoveis.length);
    const loteAtual = this.imoveis.slice(this.marcadoresCarregados, fimIndice);
    
    // Adicionar ao array de imóveis filtrados
    this.imoveisFiltrados = [...this.imoveisFiltrados, ...loteAtual];
    this.marcadoresCarregados = fimIndice;
    
    // Atualizar bounds do mapa e inicializar cluster
    if (this.marcadoresCarregados <= this.maxMarcadoresPorLote) {
      setTimeout(() => {
        this.atualizarLocalizacoes();
        this.inicializarCluster();
      }, 100);
    } else {
      // Para lotes adicionais, apenas atualizar o cluster
      this.inicializarCluster();
    }
  }

  carregarMarcadoresVisiveis(): void {
    if (!this.map?.googleMap || this.marcadoresCarregados >= this.imoveis.length) {
      return;
    }
    
    // Carregar mais marcadores se ainda houver para carregar
    if (this.marcadoresCarregados < this.imoveis.length) {
      this.carregarProximoLoteMarcadores();
    }
  }

  limparMarcadores(): void {
    this.imoveisFiltrados = [];
    
    // Limpar o cluster se existir
    if (this.clusterManager) {
      this.clusterManager.clearMarkers();
    }
  }

  getMarkerOptions(imovel: Imovel): google.maps.MarkerOptions {
    if (!this.googleMapsLoaded) return {};
    
    // Determinar ícone baseado no tipo de imóvel
    const tipo = imovel.tipo_imovel.toLowerCase();
    let iconUrl = 'assets/icons/casa.png'; // Ícone padrão
    
    if (tipo.includes('casa')) {
      iconUrl = 'assets/icons/casa.png';
    } else if (tipo.includes('apartamento')) {
      iconUrl = 'assets/icons/apartamento.png';
    } else if (tipo.includes('terreno')) {
      iconUrl = 'assets/icons/terreno.png';
    } else if (tipo.includes('comercial') || tipo.includes('sala') || tipo.includes('loja') || tipo.includes('galpão')) {
      iconUrl = 'assets/icons/comercial.png';
    } else if (tipo.includes('rural') || tipo.includes('fazenda') || tipo.includes('sítio') || tipo.includes('chácara')) {
      iconUrl = 'assets/icons/rural.png';
    }

    return {
      title: `${imovel.tipo_imovel} - R$ ${this.formatarValor(imovel.valor)} - ${imovel.desconto}% off`,
      animation: google.maps.Animation.DROP,
      icon: {
        url: iconUrl,
        scaledSize: new google.maps.Size(48, 48) // Aumentado em 50% (de 32 para 48)
      }
    };
  }

  formatarValor(valor: string): string {
    const valorNumerico = parseFloat(valor);
    return valorNumerico.toLocaleString('pt-BR');
  }

  /**
   * Seleciona um imóvel através do InfoWindow
   */
  selecionarImovelNoMapa(imovel: Imovel): void {
    if (!this.map?.googleMap) {
      console.error('Mapa não está disponível');
      return;
    }

    try {
      // Fechar qualquer InfoWindow já aberto
      this.fecharInfoWindowPersonalizado();
      
      if (!imovel.latitude || !imovel.longitude) {
        console.error('Imóvel sem coordenadas válidas');
        return;
      }
      
      // Garantir que o mapa esteja totalmente carregado antes de criar o marcador
      setTimeout(() => {
        // Centralizar o mapa na posição do imóvel primeiro
        const position = { lat: +imovel.latitude, lng: +imovel.longitude };
        this.map.googleMap?.setCenter(position);
        
        // Verificar novamente que o mapa ainda existe
        if (!this.map?.googleMap) return;
        
        // Criar marcador temporário para obter a posição correta
        const tempMarker = new google.maps.Marker({
          position: position,
          map: this.map.googleMap
        });
        
        // Usar o marcador temporário para criar o InfoWindow
        this.criarInfoWindowPersonalizadoSimples(imovel, position);
        
        // Remover o marcador temporário após um breve intervalo
        setTimeout(() => {
          tempMarker.setMap(null);
        }, 300);
      }, 200);
    } 
    catch (error) {
      console.error('Erro ao selecionar imóvel no mapa:', error);
    }
  }

  /**
   * Versão simplificada para criar InfoWindow diretamente com a posição
   */
  private criarInfoWindowPersonalizadoSimples(imovel: Imovel, position: google.maps.LatLngLiteral): void {
    // Fechar qualquer InfoWindow existente
    this.fecharInfoWindowPersonalizado();
    
    if (!this.map?.googleMap) {
      console.error('Mapa não disponível para criar InfoWindow');
      return;
    }
    
    try {
      // Criar componente usando ViewContainerRef para anexar ao DOM
      const componentRef = this.viewContainerRef.createComponent(ImovelInfoWindowComponent);
      this.infoWindowComponentRef = componentRef;
      
      // Configurar propriedades e eventos do componente
      const componentInstance = componentRef.instance;
      componentInstance.imovel = imovel;
      
      // Configurar callbacks
      componentInstance.close.subscribe(() => {
        this.fecharInfoWindowPersonalizado();
      });
      
      componentInstance.favoritar.subscribe((codigo: string) => {
        this.adicionarFavorito(imovel);
      });
      
      componentInstance.verDetalhes.subscribe((imovel: Imovel) => {
        this.router.navigate(['/imovel', imovel.codigo]);
      });
      
      // Obter o elemento DOM do componente
      const domElem = (componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0];
      
      // Anexar ao body do documento
      document.body.appendChild(domElem);
      
      // Obter posição do marcador na tela
      const mapDiv = this.map.googleMap.getDiv();
      const mapRect = mapDiv.getBoundingClientRect();
      
      // Projetar posição geográfica para pixels na tela
      const scale = Math.pow(2, this.map.googleMap.getZoom() || 10);
      const worldCoordinate = this.project(position, scale);
      
      // Converter posição do pixel para coordenadas de tela
      const pixelOffset = this.getPixelOffset(worldCoordinate, this.map.googleMap);
      
      // Posicionar o InfoWindow na tela
      const x = mapRect.left + pixelOffset.x;
      const y = mapRect.top + pixelOffset.y;
      
      // Aplicar posição ao componente
      domElem.style.position = 'fixed';
      domElem.style.left = `${x}px`;
      domElem.style.top = `${y - 320}px`; // Ajustar para ficar acima do marcador
      domElem.style.transform = 'translateX(-50%)'; // Centralizar horizontalmente
      domElem.style.zIndex = '10000';
      
      // Adicionar listener para reposicionar quando o mapa se move
      if (this.map.googleMap) {
        this.infoWindowOpenListener = this.map.googleMap.addListener('bounds_changed', () => {
          this.atualizarPosicaoInfoWindowSimples(position);
        });
      }
    } catch (error) {
      console.error('Erro ao criar InfoWindow personalizado:', error);
      this.fecharInfoWindowPersonalizado();
    }
  }

  // Método auxiliar para projetar coordenadas geográficas em coordenadas de pixel
  private project(latLng: google.maps.LatLngLiteral, scale: number): {x: number, y: number} {
    const TILE_SIZE = 256;
    const siny = Math.sin((latLng.lat * Math.PI) / 180);
    const worldCoordinateCenter = {
      x: TILE_SIZE / 2,
      y: TILE_SIZE / 2
    };
    const pixelCoordinate = {
      x: worldCoordinateCenter.x + (latLng.lng * TILE_SIZE) / 360,
      y: worldCoordinateCenter.y - (0.5 * Math.log((1 + siny) / (1 - siny)) * TILE_SIZE) / (2 * Math.PI)
    };
    return {
      x: pixelCoordinate.x * scale,
      y: pixelCoordinate.y * scale
    };
  }

  // Método auxiliar para calcular o offset de pixel
  private getPixelOffset(worldCoordinate: {x: number, y: number}, map: google.maps.Map): {x: number, y: number} {
    const scale = Math.pow(2, map.getZoom() || 10);
    const bounds = map.getBounds();
    if (!bounds) return { x: 0, y: 0 };
    
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    const topRight = this.project({lat: ne.lat(), lng: ne.lng()}, scale);
    const bottomLeft = this.project({lat: sw.lat(), lng: sw.lng()}, scale);
    
    const mapDiv = map.getDiv();
    const mapWidth = mapDiv.offsetWidth;
    const mapHeight = mapDiv.offsetHeight;
    
    // Calcular a posição relativa dentro do mapa
    const x = (worldCoordinate.x - bottomLeft.x) * (mapWidth / (topRight.x - bottomLeft.x));
    const y = (worldCoordinate.y - topRight.y) * (mapHeight / (bottomLeft.y - topRight.y));
    
    return { x, y };
  }

  /**
   * Atualiza a posição do InfoWindow personalizado quando o mapa se move
   */
  private atualizarPosicaoInfoWindowSimples(position: google.maps.LatLngLiteral): void {
    if (!this.infoWindowComponentRef || !this.map?.googleMap) return;
    
    try {
      const domElem = (this.infoWindowComponentRef.hostView as EmbeddedViewRef<any>).rootNodes[0];
      const mapDiv = this.map.googleMap.getDiv();
      const mapRect = mapDiv.getBoundingClientRect();
      
      // Calcular a nova posição na tela
      const scale = Math.pow(2, this.map.googleMap.getZoom() || 10);
      const worldCoordinate = this.project(position, scale);
      const pixelOffset = this.getPixelOffset(worldCoordinate, this.map.googleMap);
      
      // Posicionar o InfoWindow
      const x = mapRect.left + pixelOffset.x;
      const y = mapRect.top + pixelOffset.y;
      
      // Aplicar nova posição
      domElem.style.left = `${x}px`;
      domElem.style.top = `${y - 320}px`; // Ajustar para ficar acima do marcador
      
      // Garantir que o InfoWindow não saia da tela
      const infoWindowWidth = domElem.offsetWidth;
      const infoWindowHeight = domElem.offsetHeight;
      
      if (x + infoWindowWidth/2 > window.innerWidth) {
        domElem.style.left = `${window.innerWidth - infoWindowWidth/2 - 10}px`;
      } else if (x - infoWindowWidth/2 < 0) {
        domElem.style.left = `${infoWindowWidth/2 + 10}px`;
      }
      
      if (y - infoWindowHeight < 0) {
        // Se não couber acima, mostrar abaixo
        domElem.style.top = `${y + 30}px`;
      }
    } catch (error) {
      console.error('Erro ao atualizar posição do InfoWindow:', error);
    }
  }

  abrirDetalhesImovel(imovel: Imovel): void {
    // Se já existir uma janela de informações aberta, fechar primeiro
    if (this.infoWindowAtual) {
      this.infoWindowAtual.close();
      this.infoWindowAtual = null;
    }
    
    // Fechar o InfoWindow personalizado se estiver aberto
    this.fecharInfoWindowPersonalizado();
    
    // Usar método centralizado para abrir InfoWindow com um marcador temporário
    this.selecionarImovelNoMapa(imovel);
  }

  // Método para adicionar/remover um imóvel dos favoritos
  adicionarFavorito(imovel: Imovel): void {
    if (!imovel || !imovel.codigo) {
      console.error('Tentativa de favoritar um imóvel sem código válido');
      return;
    }
    
    console.log(`[MapaComponent] Adicionando/removendo imóvel dos favoritos:`, imovel);
    
    // Garantir que temos todos os dados necessários do imóvel
    const imovelCompleto: Imovel = {
      ...imovel,
      codigo: imovel.codigo,
      tipo_imovel: imovel.tipo_imovel || 'Imóvel',
      endereco: imovel.endereco || 'Endereço não disponível',
      cidade: imovel.cidade || '',
      estado: imovel.estado || '',
      bairro: imovel.bairro || '',
      valor: imovel.valor || '0',
      desconto: imovel.desconto || '0',
      latitude: imovel.latitude || 0,
      longitude: imovel.longitude || 0,
      data_criacao: imovel.data_criacao || new Date().toISOString(),
      data_atualizacao: imovel.data_atualizacao || new Date().toISOString()
    };
    
    // Chamar o serviço de favoritos para alternar o status
    this.favoritosService.toggleFavorito(imovel.codigo, imovelCompleto).subscribe({
      next: (resultado) => {
        // Verificar se a operação foi bem-sucedida
        if (resultado.status === 'success') {
          // Mostrar mensagem de sucesso
          const mensagem = resultado.action === 'added' 
            ? 'Imóvel adicionado aos favoritos' 
            : 'Imóvel removido dos favoritos';
          
          this.snackBar.open(mensagem, 'Fechar', {
            duration: 3000,
            horizontalPosition: 'end',
          });
          
          // Verificar se os dados foram salvos corretamente
          if (resultado.action === 'added') {
            const dadosLocalStorage = localStorage.getItem('favoritos_dados');
            if (dadosLocalStorage) {
              try {
                const dados = JSON.parse(dadosLocalStorage);
                if (!dados[imovel.codigo]) {
                  console.warn(`[MapaComponent] Dados do imóvel ${imovel.codigo} não foram salvos corretamente`);
                  // Tentar salvar novamente
                  this.favoritosService.addImovelData(imovelCompleto);
                }
              } catch (e) {
                console.error('[MapaComponent] Erro ao verificar dados salvos:', e);
              }
            }
          }
        }
      },
      error: (erro) => {
        console.error('Erro ao alternar favorito:', erro);
        this.snackBar.open('Erro ao gerenciar favoritos', 'Fechar', {
          duration: 5000,
        });
      }
    });
  }

  tracarRotaAteImovel(imovel: Imovel): void {
    if (!this.googleMapsLoaded || !this.map?.googleMap) return;
    
    // Se já tiver uma rota ativa, limpar primeiro
    this.limparRotaAtual();
    
    // Solicitar permissão para localização do usuário
    if (navigator.geolocation) {
      this.snackBar.open('Obtendo sua localização...', '', { duration: 2000 });
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const origem = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          const destino = {
            lat: Number(imovel.latitude),
            lng: Number(imovel.longitude)
          };
          
          this.calcularERenderizarRota(origem, destino, imovel.tipo_imovel);
        },
        (error) => {
          console.error('Erro ao obter localização:', error);
          
          // Mensagens específicas baseadas no código de erro
          let mensagemErro = 'Não foi possível obter sua localização.';
          
          switch(error.code) {
            case 1: // PERMISSION_DENIED
              mensagemErro = 'Acesso à localização negado. Por favor, permita o acesso à sua localização nas configurações do navegador.';
              break;
            case 2: // POSITION_UNAVAILABLE
              mensagemErro = 'Localização atual indisponível. Usando o centro do mapa como origem.';
              break;
            case 3: // TIMEOUT
              mensagemErro = 'Tempo esgotado ao obter sua localização. Usando o centro do mapa como origem.';
              break;
          }
          
          this.snackBar.open(mensagemErro, 'OK', { duration: 5000 });
          
          // Usar o centro do mapa como origem
          const mapCenter = this.map.googleMap?.getCenter();
          if (mapCenter) {
            const origem = {
              lat: mapCenter.lat(),
              lng: mapCenter.lng()
            };
            
            const destino = {
              lat: Number(imovel.latitude),
              lng: Number(imovel.longitude)
            };
            
            this.calcularERenderizarRota(origem, destino, imovel.tipo_imovel);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      this.snackBar.open('Geolocalização não é suportada pelo seu navegador', 'OK', { duration: 5000 });
    }
  }
  
  private calcularERenderizarRota(origem: google.maps.LatLngLiteral, destino: google.maps.LatLngLiteral, tipoImovel: string): void {
    if (!this.directionsService || !this.directionsRenderer || !this.map?.googleMap) return;
    
    // Configurar o renderer para exibir no mapa atual
    this.directionsRenderer.setMap(this.map.googleMap);
    
    // Calcular rota
    this.directionsService.route(
      {
        origin: origem,
        destination: destino,
        travelMode: google.maps.TravelMode.DRIVING
      },
      (resultado, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          // Mostrar rota no mapa
          this.directionsRenderer?.setDirections(resultado);
          this.rotaAtiva = true;
          
          // Extrair informações da rota
          const rota = resultado?.routes[0];
          if (rota && rota.legs[0]) {
            const distancia = rota.legs[0].distance?.text || '0 km';
            const tempo = rota.legs[0].duration?.text || '0 min';
            
            this.snackBar.open(`Rota até ${tipoImovel}: ${distancia} (${tempo})`, 'Fechar', { duration: 5000 });
          }
        } else if (status === "REQUEST_DENIED") {
          console.error('Erro ao calcular rota:', status);
          this.snackBar.open('A API do Google Maps não está configurada para o serviço de rotas. Entre em contato com o administrador.', 'Entendi', { 
            duration: 7000,
            panelClass: ['error-snackbar']
          });
        } else {
          console.error('Erro ao calcular rota:', status);
          this.snackBar.open('Não foi possível calcular a rota para este imóvel', 'Fechar', { duration: 3000 });
        }
      }
    );
  }
  
  limparRotaAtual(): void {
    if (this.rotaAtiva && this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
      this.rotaAtiva = false;
    }
  }

  limparFiltros() {
    // Limpar qualquer rota existente
    this.limparRotaAtual();
    
    this.filtros = {
      estado: '',
      cidade: '',
      bairro: '',
      tipo: '',
      valorMin: null,
      valorMax: null,
      descontoMin: null
    };
    
    this.cidades = [];
    this.bairros = [];
    this.imoveis = [];
    this.imoveisFiltrados = [];
    this.marcadoresCarregados = 0;
    
    // Resetar zoom e centro do mapa
    if (this.map?.googleMap) {
      this.map.googleMap.setCenter(this.center);
      this.map.googleMap.setZoom(4);
    }
  }

  atualizarLocalizacoes(): void {
    if (!this.googleMapsLoaded || !this.imoveisFiltrados.length) return;

    const bounds = new google.maps.LatLngBounds();
    let marcadoresValidos = 0;

    this.imoveisFiltrados.forEach(imovel => {
      const lat = Number(imovel.latitude);
      const lng = Number(imovel.longitude);
      
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        bounds.extend({ lat, lng });
        marcadoresValidos++;
      }
    });

    if (marcadoresValidos > 0) {
      if (this.map) {
        this.map.fitBounds(bounds);
        
        if (marcadoresValidos === 1) {
          const mapInstance = this.map.googleMap;
          if (mapInstance) {
            mapInstance.setZoom(15);
          }
        }
      }
    }
  }

  inicializarCluster(): void {
    if (!this.isBrowser || !this.googleMapsLoaded || !this.map?.googleMap) return;
    
    // Limpar cluster anterior se existir
    if (this.clusterManager) {
      this.clusterManager.clearMarkers();
    }

    // Criar objetos de marcadores para clustering
    const markers = this.imoveisFiltrados.map(imovel => {
      const position = { 
        lat: Number(imovel.latitude), 
        lng: Number(imovel.longitude) 
      };
      
      if (isNaN(position.lat) || isNaN(position.lng) || 
          position.lat === 0 || position.lng === 0) {
        return null;
      }
      
      const marker = new google.maps.Marker({
        position: position,
        map: this.map.googleMap,
        ...this.getMarkerOptions(imovel)
      });
      
      // Adicionar evento de clique
      marker.addListener('click', () => {
        this.abrirDetalhesImovel(imovel);
      });
      
      return marker;
    }).filter(marker => marker !== null) as google.maps.Marker[];
    
    // Configurar o clusterer com opções otimizadas
    if (typeof window !== 'undefined' && window.markerClusterer) {
      const MarkerClusterer = window.markerClusterer.MarkerClusterer;
      const SuperClusterAlgorithm = window.markerClusterer.SuperClusterAlgorithm;
      
      this.clusterManager = new MarkerClusterer({
        map: this.map.googleMap,
        markers: markers,
        algorithm: new SuperClusterAlgorithm({
          radius: 60,
          maxZoom: 15
        }),
        renderer: {
          render: ({ count, position }: { count: number, position: google.maps.LatLng }) => {
            return new google.maps.Marker({
              position,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: "#673AB7", // Roxo mais neutro para clusters
                fillOpacity: 0.9,
                strokeColor: "#fff",
                strokeWeight: 2,
                scale: count < 10 ? 22 : count < 100 ? 30 : 38,
              },
              label: {
                text: String(count),
                color: "#fff",
                fontSize: "12px",
                fontWeight: "bold"
              },
              zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
            });
          }
        }
      });
    }
  }

  recarregarPagina(): void {
    if (this.isBrowser) {
      window.location.reload();
    }
  }

  ngOnDestroy(): void {
    // Limpar qualquer InfoWindow personalizado que esteja aberto
    this.fecharInfoWindowPersonalizado();
    
    // Limpar outros recursos se necessário
    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
    }
  }

  /**
   * Manipula o clique em um marcador
   */
  markerClicked(marker: MapMarker, imovel: Imovel): void {
    // Ignora o marker e usa o método selecionarImovelNoMapa que já tem tratamento para marcadores
    if (this.map?.googleMap) {
      this.selecionarImovelNoMapa(imovel);
    }
  }

  /**
   * Fecha o InfoWindow personalizado
   */
  private fecharInfoWindowPersonalizado(): void {
    try {
      // Remover listener de atualização de posição
      if (this.infoWindowOpenListener) {
        google.maps.event.removeListener(this.infoWindowOpenListener);
        this.infoWindowOpenListener = null;
      }
      
      if (this.infoWindowComponentRef) {
        try {
          // Obter referência ao elemento DOM
          const viewRef = this.infoWindowComponentRef.hostView;
          const domElem = (viewRef as EmbeddedViewRef<any>).rootNodes[0];
          
          // Remover do DOM
          if (domElem && domElem.parentNode) {
            domElem.parentNode.removeChild(domElem);
          }
          
          // Destruir o componente
          this.applicationRef.detachView(viewRef);
          this.infoWindowComponentRef.destroy();
        } catch (e) {
          console.error('Erro ao remover InfoWindow do DOM:', e);
        } finally {
          // Sempre garantir que a referência seja nula
          this.infoWindowComponentRef = null;
        }
      }
    } catch (error) {
      console.error('Erro ao fechar InfoWindow:', error);
      // Em caso de erro, garantir que a referência seja nula
      this.infoWindowComponentRef = null;
    }
  }

  private atualizarMarcadores(): void {
    // Não precisamos recriar todos os marcadores, pois o estado do favorito
    // é gerenciado pelo componente InfoWindow e pelo FavoritosService
    
    // Se houver alterações futuras que exijam atualização visual dos marcadores,
    // podemos implementá-las aqui conforme a necessidade
    
    // Por enquanto, apenas garantimos que o InfoWindow reflete o estado atual
  }

  // Buscar os detalhes completos do imóvel para o InfoWindow
  private buscarDetalhesImovel(imovel: Imovel, marker: google.maps.Marker): void {
    if (!this.isBrowser) return;
    
    if (this.infoWindowAtual) {
      this.infoWindowAtual.close();
    }
    
    // Criamos um componente dinâmico para o conteúdo do InfoWindow
    if (!this.injector) {
      console.error('Injector não está disponível');
      return;
    }

    // Criar um injector customizado com dados adicionais
    const injector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: 'IMOVEL', useValue: imovel },
        { provide: 'IS_FAVORITO', useValue: this.favoritosService.isFavorito(imovel.codigo) },
        { provide: 'USER_AUTHENTICATED', useValue: true }  // Sempre permitir favoritos no modo dev
      ]
    });

    // Referência para o componente criado dinamicamente
    this.infoWindowComponentRef = this.componentFactoryResolver.resolveComponentFactory(ImovelInfoWindowComponent)
      .create(injector);
    
    // Detectar mudanças para inicializar o componente com os dados
    this.infoWindowComponentRef.changeDetectorRef.detectChanges();
    
    // Obter o HTML renderizado do componente
    const htmlElement = this.infoWindowComponentRef.location.nativeElement;
    
    // Configurar o InfoWindow com nosso HTML customizado
    const infoWindow = new google.maps.InfoWindow({
      content: htmlElement
    });
    
    // Quando o InfoWindow é fechado, limpar a referência e destruir o componente
    google.maps.event.addListener(infoWindow, 'closeclick', () => {
      if (this.infoWindowComponentRef) {
        this.infoWindowComponentRef.destroy();
        this.infoWindowComponentRef = null;
      }
      this.infoWindowAtual = null;
    });
    
    // Escutar o evento de favoritar que vem do componente
    this.infoWindowComponentRef.instance.favoritar.subscribe((favorito: boolean) => {
      this.adicionarFavorito(imovel);
    });
    
    // Escutar o evento de fechar que vem do componente
    this.infoWindowComponentRef.instance.close.subscribe(() => {
      infoWindow.close();
      if (this.infoWindowComponentRef) {
        this.infoWindowComponentRef.destroy();
        this.infoWindowComponentRef = null;
      }
      this.infoWindowAtual = null;
    });
    
    // Abrir o InfoWindow no marcador
    const googleMapNativo = this.map.googleMap;
    if (googleMapNativo) {
      infoWindow.open(googleMapNativo, marker);
      this.infoWindowAtual = infoWindow;
    } else {
      console.error('Mapa nativo do Google não está disponível');
    }
  }

  // Método para favoritar via InfoWindow
  toggleFavorito(imovel: Imovel): void {
    if (!imovel || !imovel.codigo) {
      console.error('Tentativa de favoritar um imóvel sem código válido');
      return;
    }
    
    console.log(`[MapaComponent] Toggle favorito para imóvel:`, imovel);
    
    // Chamar o serviço para alternar o favorito
    this.favoritosService.toggleFavorito(imovel.codigo, imovel).subscribe({
      next: (resultado) => {
        if (resultado.status === 'success') {
          // Mostrar mensagem de sucesso
          const mensagem = resultado.action === 'added' 
            ? 'Imóvel adicionado aos favoritos' 
            : 'Imóvel removido dos favoritos';
          
          this.snackBar.open(mensagem, 'Fechar', {
            duration: 3000,
            horizontalPosition: 'end',
          });
        }
      },
      error: (erro) => {
        console.error('Erro ao alternar favorito:', erro);
        this.snackBar.open('Erro ao gerenciar favoritos', 'Fechar', {
          duration: 5000,
        });
      }
    });
  }
}
