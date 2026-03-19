import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  BackofficeCatalogService,
  type AdminCategory,
} from '../../../core/services/backoffice-catalog.service';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';

@Component({
  selector: 'app-bo-category-form',
  imports: [RouterLink, FormsModule, AlertBanner],
  templateUrl: './category-form.html',
})
export class BoCategoryFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogService = inject(BackofficeCatalogService);

  protected readonly isEdit = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly serverFieldErrors = signal<Record<string, string>>({});
  protected submitted = false;
  protected readonly parentCategories = signal<AdminCategory[]>([]);

  private editId = 0;

  protected form = {
    name: '',
    slug: '',
    description: '',
    parentId: null as number | null,
  };

  ngOnInit() {
    const catId = this.route.snapshot.paramMap.get('categoryId');
    if (catId) {
      this.isEdit.set(true);
      this.editId = Number(catId);
      this.loading.set(true);
      this.loadCategory(this.editId);
    }
    this.loadParentCategories();
  }

  onSave(formRef: { valid?: boolean | null }) {
    this.submitted = true;
    if (!formRef.valid) return;

    this.saving.set(true);
    this.errorMsg.set('');
    this.serverFieldErrors.set({});

    const body: Record<string, unknown> = {
      name: this.form.name,
      slug: this.form.slug,
      description: this.form.description || undefined,
      parentId: this.isEdit() ? this.form.parentId : (this.form.parentId ?? undefined),
    };

    const request = this.isEdit()
      ? this.catalogService.updateCategory(this.editId, body)
      : this.catalogService.createCategory(body);

    request.subscribe({
      next: () => {
        this.router.navigate(['/backoffice/categories']);
      },
      error: (err) => {
        this.saving.set(false);
        const body = extractErrorBody(err.error);
        if (body.fieldErrors) {
          this.serverFieldErrors.set(body.fieldErrors);
          this.errorMsg.set('Please fix the errors below.');
        } else {
          this.errorMsg.set(body.message ?? 'Failed to save category');
        }
      },
    });
  }

  private loadCategory(id: number) {
    this.catalogService.listCategories({ limit: 100 }).subscribe({
      next: (res) => {
        const cat = res.data.find((c) => c.id === id);
        if (cat) {
          this.form = {
            name: cat.name,
            slug: cat.slug,
            description: cat.description ?? '',
            parentId: cat.parentId,
          };
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadParentCategories() {
    this.catalogService.listCategories({ limit: 100 }).subscribe({
      next: (res) => {
        const filtered = this.isEdit() ? res.data.filter((c) => c.id !== this.editId) : res.data;
        this.parentCategories.set(filtered);
      },
    });
  }
}
