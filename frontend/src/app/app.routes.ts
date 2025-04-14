import { Routes } from '@angular/router';
import { ImovelListComponent } from './components/imovel-list/imovel-list.component';
import { MapaComponent } from './components/mapa/mapa.component';
import { LoginComponent } from './components/login/login.component';
import { FavoritosComponent } from './components/favoritos/favoritos.component';

export const routes: Routes = [
  { path: '', redirectTo: '/imoveis', pathMatch: 'full' },
  { path: 'imoveis', component: ImovelListComponent },
  { 
    path: 'mapa', 
    component: MapaComponent,
    data: { ssr: false } 
  },
  { path: 'login', component: LoginComponent, data: { title: 'Entrar na conta' } },
  { path: 'favoritos', component: FavoritosComponent, data: { title: 'Meus favoritos' } },
  { path: '**', redirectTo: '/imoveis' }
];
