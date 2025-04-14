import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImovelInfoWindowComponent } from './imovel-info-window.component';

describe('ImovelInfoWindowComponent', () => {
  let component: ImovelInfoWindowComponent;
  let fixture: ComponentFixture<ImovelInfoWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImovelInfoWindowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImovelInfoWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
