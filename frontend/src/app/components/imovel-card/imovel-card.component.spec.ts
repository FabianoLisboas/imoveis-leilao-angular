import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImovelCardComponent } from './imovel-card.component';

describe('ImovelCardComponent', () => {
  let component: ImovelCardComponent;
  let fixture: ComponentFixture<ImovelCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImovelCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImovelCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
