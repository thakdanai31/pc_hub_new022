import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  BackofficeCatalogService,
  type AdminBrand,
} from '../../../core/services/backoffice-catalog.service';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';

@Component({
  selector: 'app-bo-brand-form',
  imports: [RouterLink, FormsModule, AlertBanner],
  templateUrl: './brand-form.html',
})
export class BoBrandFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogService = inject(BackofficeCatalogService);

  protected readonly isEdit = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly serverFieldErrors = signal<Record<string, string>>({});
  protected submitted = false;

  protected readonly previewUrl = signal<string | null>(null);
  protected readonly existingLogoUrl = signal<string | null>(null);
  private selectedFile: File | null = null;

  private editId = 0;

  protected form = {
    name: '',
    slug: '',
  };

  ngOnInit() {
    const brandId = this.route.snapshot.paramMap.get('brandId');
    if (brandId) {
      this.isEdit.set(true);
      this.editId = Number(brandId);
      this.loading.set(true);
      this.loadBrand(this.editId);
    }
  }

  onFileSelected(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    if (!file) return;

    this.selectedFile = file;
    // Revoke old preview URL to avoid memory leak
    const oldUrl = this.previewUrl();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  removeSelectedFile() {
    const oldUrl = this.previewUrl();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    this.previewUrl.set(null);
    this.selectedFile = null;
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
    };

    const request = this.isEdit()
      ? this.catalogService.updateBrand(this.editId, body)
      : this.catalogService.createBrand(body);

    request.subscribe({
      next: (res) => {
        const brandId = this.isEdit() ? this.editId : res.data.id;
        if (this.selectedFile) {
          this.uploadLogo(brandId);
        } else {
          this.router.navigate(['/backoffice/brands']);
        }
      },
      error: (err) => {
        this.saving.set(false);
        const errBody = extractErrorBody(err.error);
        if (errBody.fieldErrors) {
          this.serverFieldErrors.set(errBody.fieldErrors);
          this.errorMsg.set('Please fix the errors below.');
        } else {
          this.errorMsg.set(errBody.message ?? 'Failed to save brand');
        }
      },
    });
  }

  private uploadLogo(brandId: number) {
    if (!this.selectedFile) return;
    this.catalogService.uploadBrandLogo(brandId, this.selectedFile).subscribe({
      next: () => {
        this.router.navigate(['/backoffice/brands']);
      },
      error: () => {
        // Brand was saved but logo upload failed — still navigate but show would be ideal
        this.router.navigate(['/backoffice/brands']);
      },
    });
  }

  private loadBrand(id: number) {
    this.catalogService.listBrands({ limit: 100 }).subscribe({
      next: (res) => {
        const brand = res.data.find((b: AdminBrand) => b.id === id);
        if (brand) {
          this.form = {
            name: brand.name,
            slug: brand.slug,
          };
          this.existingLogoUrl.set(brand.logoUrl ?? null);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
