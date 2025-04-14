import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImovelListComponent } from './imovel-list.component';

describe('ImovelListComponent', () => {
  let component: ImovelListComponent;
  let fixture: ComponentFixture<ImovelListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImovelListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImovelListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
