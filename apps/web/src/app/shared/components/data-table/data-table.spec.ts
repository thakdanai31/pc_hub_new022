import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DataTable } from './data-table';

@Component({
  selector: 'app-test-host',
  imports: [DataTable],
  template: `
    <app-data-table>
      <thead>
        <tr><th>Name</th></tr>
      </thead>
      <tbody>
        <tr><td>Test Item</td></tr>
      </tbody>
    </app-data-table>
  `,
})
class TestHost {}

describe('DataTable', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
  });

  it('projects table content', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('table')).toBeTruthy();
    expect(el.textContent).toContain('Name');
    expect(el.textContent).toContain('Test Item');
  });

  it('wraps table in styled container', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    const wrapper = fixture.nativeElement.querySelector('.rounded-2xl') as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.classList.contains('shadow-md')).toBe(true);
  });
});
