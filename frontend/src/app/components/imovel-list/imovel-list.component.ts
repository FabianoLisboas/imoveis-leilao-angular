import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { ImovelCardComponent } from '../imovel-card/imovel-card.component';
import { ImovelService } from '../../services/imovel.service';
import { Imovel, ApiResponse } from '../../models/imovel';

@Component({
  selector: 'app-imovel-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatPaginatorModule,
    MatMenuModule,
    ImovelCardComponent
  ],
  template: `
    <div class="container">
      <div class="filtros">
        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select [(ngModel)]="filtros.estado" (selectionChange)="onEstadoChange()">
            <mat-option [value]="''">Todos</mat-option>
            <mat-option *ngFor="let estado of estados" [value]="estado">
              {{estado}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Cidade</mat-label>
          <mat-select [(ngModel)]="filtros.cidade" (selectionChange)="onCidadeChange()" [disabled]="!filtros.estado">
            <mat-option [value]="''">Todas</mat-option>
            <mat-option *ngFor="let cidade of cidades" [value]="cidade">
              {{cidade}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Bairro</mat-label>
          <mat-select [(ngModel)]="filtros.bairro" [disabled]="!filtros.cidade">
            <mat-option [value]="''">Todos</mat-option>
            <mat-option *ngFor="let bairro of bairros" [value]="bairro">
              {{bairro}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tipo de Imóvel</mat-label>
          <mat-select [(ngModel)]="filtros.tipo">
            <mat-option [value]="''">Todos</mat-option>
            <mat-option *ngFor="let tipo of tiposImoveis" [value]="tipo">
              {{tipo}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <div class="filtro-preco-container">
          <button mat-stroked-button [matMenuTriggerFor]="priceMenu" class="botao-filtro-preco">
            <span>{{ getTextoBotaoPreco() }}</span>
            <mat-icon>arrow_drop_down</mat-icon>
          </button>
          <mat-menu #priceMenu="matMenu" class="menu-preco">
            <div class="menu-preco-content" (click)="$event.stopPropagation()"> 
              <h5>Preço</h5>
              <div class="inputs-preco">
                <div class="input-com-label">
                  <label class="input-label-externo">De</label>
                  <mat-form-field appearance="outline" class="input-preco">
                    <input matInput type="number" [(ngModel)]="filtros.valorMin" placeholder="Mínimo">
                    <span matPrefix>R$&nbsp;</span>
                  </mat-form-field>
                </div>
                <div class="input-com-label">
                  <label class="input-label-externo">Até</label>
                  <mat-form-field appearance="outline" class="input-preco">
                    <input matInput type="number" [(ngModel)]="filtros.valorMax" placeholder="Máximo">
                    <span matPrefix>R$&nbsp;</span>
                  </mat-form-field>
                </div>
              </div>
              <div class="acoes-menu-preco">
                <button mat-button (click)="limparFiltroPreco()">Limpar</button>
                <button mat-raised-button color="primary" (click)="aplicarFiltros()">Aplicar</button> 
              </div>
            </div>
          </mat-menu>
        </div>
        
        <mat-form-field appearance="outline">
          <mat-label>Desconto Mínimo (%)</mat-label>
          <input matInput type="number" [(ngModel)]="filtros.descontoMin" placeholder="Ex: 10">
        </mat-form-field>

        <button mat-raised-button color="primary" (click)="aplicarFiltros()" class="botao-buscar">
          <mat-icon>search</mat-icon>
          Buscar Imóveis
        </button>

        <button mat-button (click)="limparFiltros()" class="botao-limpar">
          <mat-icon>clear_all</mat-icon>
          Limpar Filtros
        </button>
      </div>

      <div class="resultados">
        <h2 *ngIf="!carregando">{{totalImoveis}} imóveis encontrados</h2>
        
        <div class="loading" *ngIf="carregando">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Carregando imóveis...</p>
        </div>

        <div class="imoveis-grid" *ngIf="!carregando">
          <app-imovel-card
            *ngFor="let imovel of imoveis"
            [imovel]="imovel"
            
          ></app-imovel-card>
        </div>

        <mat-paginator
          [length]="totalImoveis"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 20, 50, 100]"
          (page)="onPageChange($event)"
          aria-label="Selecione a página"
        ></mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .container {
      padding: 16px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .filtros {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
      padding: 12px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);

      mat-form-field.mat-mdc-form-field {
        height: auto !important;
        line-height: 1.3;

        .mat-mdc-form-field-flex {
          padding: 6px 12px !important;
          align-items: center;
          height: 40px;
        }

        .mat-mdc-floating-label {
          top: 14px !important;
          font-size: 11px !important;
        }
        .mat-mdc-label {
            font-size: 13px !important;
            top: 15px !important;
        }

        .mat-mdc-form-field-input-control,
        .mat-mdc-select-value {
          font-size: 13px !important;
          padding-top: 2px;
        }
        
        .mat-mdc-select-arrow {
            margin-top: -4px;
        }
        
        .mat-mdc-form-field-subscript-wrapper {
            display: none;
        }
      }

      .filtro-preco-container {
        height: 55px;
        display: flex;
        align-items: center;
      }
      
      .botao-filtro-preco {
        height: 100%;
        width: 100%;
        font-size: 16px;
        line-height: 1.3;
        padding: 0 12px;
        border-radius: 4px;
        border: 1px solid rgba(0, 0, 0, 0.23);
        text-align: left;
        justify-content: space-between;
        box-sizing: border-box;
        font-weight: 400;
        display: flex;
        align-items: center;

        span:first-of-type {
          color: rgba(0, 0, 0, 0.87);
          flex-grow: 1;
        }

        mat-icon {
          color: rgba(0, 0, 0, 0.54);
        }
      }

      .botao-buscar,
      .botao-limpar {
         height: 40px;
         margin-top: 0;
         align-self: center;
         padding: 0 12px;
         font-size: 13px;
      }
    }

    .resultados {
      h2 {
        margin-bottom: 24px;
        color: rgba(0,0,0,0.87);
      }
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;

      p {
        margin-top: 16px;
        color: rgba(0,0,0,0.6);
      }
    }

    .imoveis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    mat-paginator {
      background: transparent;
    }

    .menu-preco-content {
      padding: 8px;
      width: 240px;
    }
    .menu-preco-content h5 {
      margin-top: 0;
      margin-bottom: 16px;
    }
    .inputs-preco {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .input-com-label {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .input-label-externo {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.6);
      margin-bottom: 4px;
      display: block;
    }

    .input-preco {
      width: 100%;
      max-width: 110px;

      // Estilo para o prefixo R$
      span[matPrefix] {
        font-size: 13px !important; 
        margin-left: 2px;
        margin-right: 2px; 
        color: rgba(0, 0, 0, 0.6); 
      }
    }

    .acoes-menu-preco {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    
    .cdk-overlay-pane:has(.menu-preco) {
        pointer-events: auto !important; 
    }

    // Ajustar fonte do Placeholder (Mínimo/Máximo)
    input::placeholder {
      font-size: 11px !important; // Reduzir o tamanho da fonte do placeholder
      color: rgba(0, 0, 0, 0.42); // Cor padrão de placeholder do Material
      // margin-left: 20px !important; // Remover margin-left do placeholder
    }
  `]
})
export class ImovelListComponent implements OnInit {
  imoveis: Imovel[] = [];
  carregando = false;
  totalImoveis = 0;
  pageSize = 100;
  currentPage = 1;

  estados: string[] = [];
  cidades: string[] = [];
  bairros: string[] = [];
  tiposImoveis: string[] = [
    'Apartamento',
    'Casa',
    'Comercial',
    'Terreno',
    'Outros'
  ];

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
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.carregarEstados();
  }

  carregarImoveis(): void {
    this.carregando = true;
    
    // Debug - Mostrar o valor do tipo antes de construir o objeto
    console.log('Valor do filtro tipo antes de construir objeto:', this.filtros.tipo);
    
    // Debug - Mostrar o valor do filtro valorMax antes de construir objeto
    console.log('Valor do filtro valorMax antes de construir objeto:', this.filtros.valorMax);
    
    // Construir objeto de filtros para a API
    const filtrosApi: Record<string, any> = {};
    if (this.filtros.estado) filtrosApi['estado'] = this.filtros.estado;
    if (this.filtros.cidade) filtrosApi['cidade'] = this.filtros.cidade;
    if (this.filtros.bairro) filtrosApi['bairro'] = this.filtros.bairro;
    if (this.filtros.tipo) filtrosApi['tipo_imovel'] = this.filtros.tipo;
    if (this.filtros.valorMin) filtrosApi['valor_min'] = this.filtros.valorMin;
    if (this.filtros.valorMax) filtrosApi['valor_max'] = this.filtros.valorMax;
    if (this.filtros.descontoMin) filtrosApi['desconto_min'] = this.filtros.descontoMin;
    
    console.log('Carregando imóveis com filtros:', filtrosApi);
    
    // Debug - Verificar o objeto de filtros completo após a construção
    console.log('Objeto de filtros completo (JSON):', JSON.stringify(filtrosApi));
    
    this.imovelService.getImoveis(this.currentPage, this.pageSize, filtrosApi)
      .subscribe({
        next: (response: ApiResponse<Imovel>) => {
          this.imoveis = response.results || [];
          this.totalImoveis = response.count || 0;
          
          // DEBUG: Verificar a estrutura do primeiro imóvel recebido
          if (this.imoveis.length > 0) {
            console.log('DEBUG: Dados do primeiro imóvel recebido na lista:', JSON.stringify(this.imoveis[0], null, 2));
          }
          
          console.log(`${response.count} imóveis encontrados, exibindo ${this.imoveis?.length || 0}`);
          
          // Verificar e processar imagens
          this.imoveis.forEach(imovel => {
            // Verificar se o imóvel tem código
            if (!imovel.codigo) {
              console.warn(`Imóvel sem código: ${imovel.tipo_imovel} em ${imovel.cidade}-${imovel.estado}`);
            }
            
            // Garantir que desconto seja um número para exibição
            if (imovel.desconto && typeof imovel.desconto === 'string') {
              imovel.desconto = imovel.desconto.replace('%', '').trim();
            }
            
            // Não precisamos manipular a URL da imagem aqui, o componente card faz isso
            console.log(`Imóvel ${imovel.codigo}: ${imovel.tipo_imovel}, ${imovel.cidade}-${imovel.estado}, R$ ${imovel.valor}`);
          });
          
          this.carregando = false;
        },
        error: (error) => {
          console.error('Erro ao carregar imóveis:', error);
          this.snackBar.open('Erro ao carregar imóveis', 'Fechar', { duration: 3000 });
          this.carregando = false;
        }
      });
  }

  carregarEstados(): void {
    this.imovelService.getEstados().subscribe({
      next: (estados) => {
        this.estados = estados;
      },
      error: (error) => {
        console.error('Erro ao carregar estados:', error);
      }
    });
  }

  onEstadoChange(): void {
    this.filtros.cidade = '';
    this.filtros.bairro = '';
    this.cidades = [];
    this.bairros = [];
    
    if (this.filtros.estado) {
      this.imovelService.getCidadesPorEstado(this.filtros.estado).subscribe({
        next: (cidades) => {
          this.cidades = cidades;
        },
        error: (error) => {
          console.error('Erro ao carregar cidades:', error);
        }
      });
    }
    // Não aplica filtros automaticamente aqui
  }

  onCidadeChange(): void {
    this.filtros.bairro = '';
    this.bairros = [];
    
    if (this.filtros.cidade) {
      this.imovelService.getBairrosPorCidade(this.filtros.cidade).subscribe({
        next: (bairros) => {
          this.bairros = bairros;
        },
        error: (error) => {
          console.error('Erro ao carregar bairros:', error);
        }
      });
    }
    // Não aplica filtros automaticamente aqui
  }

  aplicarFiltros(): void {
    this.currentPage = 1;
    this.carregarImoveis();
  }

  limparFiltros(): void {
    this.filtros = {
      estado: '',
      cidade: '',
      bairro: '',
      tipo: '',
      valorMin: null,
      valorMax: null,
      descontoMin: null
    };
    this.aplicarFiltros();
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex + 1;
    this.carregarImoveis();
  }

  /**
   * Retorna o texto a ser exibido no botão de filtro de preço.
   */
  getTextoBotaoPreco(): string {
    const min = this.filtros.valorMin;
    const max = this.filtros.valorMax;

    if (min != null && max != null) {
      return `R$ ${this.formatarNumero(min)} - R$ ${this.formatarNumero(max)}`;
    } else if (min != null) {
      return `A partir de R$ ${this.formatarNumero(min)}`;
    } else if (max != null) {
      return `Até R$ ${this.formatarNumero(max)}`;
    } else {
      return 'Preço';
    }
  }

  /**
   * Formata um número para exibição (ex: 100000 -> 100k).
   * Simplificado para demonstração.
   */
  private formatarNumero(valor: number): string {
    if (valor >= 1000000) {
      return `${(valor / 1000000).toFixed(1).replace('.', ',')}M`;
    } else if (valor >= 1000) {
      return `${Math.round(valor / 1000)}k`;
    } else {
      return valor.toString();
    }
  }

  /**
   * Limpa apenas os filtros de valor mínimo e máximo.
   */
  limparFiltroPreco(): void {
    this.filtros.valorMin = null;
    this.filtros.valorMax = null;
    // Não chama aplicarFiltros aqui, espera o usuário clicar em aplicar no menu ou buscar geral
  }
}
