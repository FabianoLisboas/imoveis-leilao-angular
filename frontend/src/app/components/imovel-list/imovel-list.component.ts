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
    ImovelCardComponent
  ],
  template: `
    <div class="container">
      <div class="filtros">
        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select [(ngModel)]="filtros.estado" (selectionChange)="onEstadoChange()">
            <mat-option>Todos</mat-option>
            <mat-option *ngFor="let estado of estados" [value]="estado">
              {{estado}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Cidade</mat-label>
          <mat-select [(ngModel)]="filtros.cidade" (selectionChange)="onCidadeChange()" [disabled]="!filtros.estado">
            <mat-option>Todas</mat-option>
            <mat-option *ngFor="let cidade of cidades" [value]="cidade">
              {{cidade}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Bairro</mat-label>
          <mat-select [(ngModel)]="filtros.bairro" (selectionChange)="aplicarFiltros()" [disabled]="!filtros.cidade">
            <mat-option>Todos</mat-option>
            <mat-option *ngFor="let bairro of bairros" [value]="bairro">
              {{bairro}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tipo de Imóvel</mat-label>
          <mat-select [(ngModel)]="filtros.tipo" (selectionChange)="aplicarFiltros()">
            <mat-option>Todos</mat-option>
            <mat-option *ngFor="let tipo of tiposImoveis" [value]="tipo">
              {{tipo}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <div class="valor-container">
          <mat-form-field appearance="outline">
            <mat-label>Valor Mínimo</mat-label>
            <input matInput type="number" [(ngModel)]="filtros.valorMin" (change)="aplicarFiltros()">
            <span matPrefix>R$ </span>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Valor Máximo</mat-label>
            <input matInput type="number" [(ngModel)]="filtros.valorMax" (change)="aplicarFiltros()">
            <span matPrefix>R$ </span>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Desconto Mínimo (%)</mat-label>
          <input matInput type="number" [(ngModel)]="filtros.descontoMin" (change)="aplicarFiltros()">
        </mat-form-field>

        <button mat-raised-button color="primary" (click)="limparFiltros()">
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
            (toggleFavorito)="toggleFavorito($event)"
          ></app-imovel-card>
        </div>

        <mat-paginator
          [length]="totalImoveis"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 20, 50]"
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
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
      padding: 16px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);

      .valor-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      button {
        height: 56px;
        margin-top: 4px;
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
  `]
})
export class ImovelListComponent implements OnInit {
  imoveis: Imovel[] = [];
  carregando = true;
  totalImoveis = 0;
  pageSize = 10;
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
    this.carregarImoveis();
    this.carregarEstados();
  }

  carregarImoveis(): void {
    this.carregando = true;
    
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
    
    this.imovelService.getImoveis(this.currentPage, this.pageSize, filtrosApi)
      .subscribe({
        next: (response: ApiResponse<Imovel>) => {
          this.imoveis = response.results || [];
          this.totalImoveis = response.count || 0;
          
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
    
    this.aplicarFiltros();
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
    
    this.aplicarFiltros();
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

  toggleFavorito(imovel: Imovel): void {
    console.log('Toggle favorito:', imovel);
    // Aqui vai a lógica para adicionar/remover dos favoritos
    this.snackBar.open('Funcionalidade em desenvolvimento', 'Fechar', { duration: 3000 });
  }
}
