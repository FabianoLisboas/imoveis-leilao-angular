import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  id: number;
  email: string;
  username?: string;
  nome?: string;
  sobrenome?: string;
  google_id?: string;
  authenticated?: boolean;
  isAuthenticated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth/google/`;
  private userUrl = `${environment.apiUrl}/usuarios/me/`;
  private logoutUrl = `${environment.apiUrl}/logout/`; // URL de logout corrigida
  private currentUserSubject = new BehaviorSubject<UserProfile | null>(null);
  public currentUser = this.currentUserSubject.asObservable();
  
  constructor(private http: HttpClient) {
    this.checkCurrentUser();
  }

  // Verificar se já existe um usuário logado ao iniciar o serviço
  private checkCurrentUser(): void {
    this.getUserProfile().subscribe();
  }

  // Autenticar com Google
  loginWithGoogle(token: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    
    const body = `token=${encodeURIComponent(token)}`;
    
    return this.http.post<any>(this.apiUrl, body, { 
      headers, 
      withCredentials: true
    }).pipe(
      tap(() => {
        // Buscar o perfil do usuário após o login bem-sucedido
        this.getUserProfile().subscribe();
      }),
      catchError(error => {
        console.error('Erro ao autenticar com Google:', error);
        this.currentUserSubject.next(null);
        return of(null);
      })
    );
  }

  // Obter perfil do usuário logado
  getUserProfile(): Observable<UserProfile | null> {
    return this.http.get<any>(this.userUrl, { 
      withCredentials: true
    }).pipe(
      map(user => {
        if (user && user.authenticated) {
          const userProfile: UserProfile = {
            id: user.id,
            email: user.email,
            username: user.username,
            nome: user.nome,
            sobrenome: user.sobrenome,
            google_id: user.google_id,
            authenticated: user.authenticated,
            isAuthenticated: true
          };
          this.currentUserSubject.next(userProfile);
          return userProfile;
        } else {
          this.currentUserSubject.next(null);
          return null;
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // Erro 401 é esperado quando não está autenticado
        if (error.status !== 401) {
          console.error('Erro ao obter perfil de usuário:', error);
        }
        this.currentUserSubject.next(null);
        return of(null);
      })
    );
  }

  // Verificar se o usuário está autenticado (baseado no estado atual)
  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  // Logout
  logout(): Observable<any> {
    return this.http.post(this.logoutUrl, {}, {
      withCredentials: true
    }).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
      }),
      catchError(error => {
        console.error('Erro ao fazer logout:', error);
        // Mesmo com erro, limpar o usuário localmente
        this.currentUserSubject.next(null);
        return of(null);
      })
    );
  }
} 