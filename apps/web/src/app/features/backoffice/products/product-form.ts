import { Component, inject, signal, OnInit, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  BackofficeCatalogService,
  type AdminProductDetail,
  type AdminCategory,
  type AdminBrand,
} from '../../../core/services/backoffice-catalog.service';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';

export interface PendingFile {
  file: File;
  previewUrl: string;
}

@Component({
  selector: 'app-bo-product-form',
  imports: [RouterLink, FormsModule, AlertBanner, ConfirmDialog],
  templateUrl: './product-form.html',
})
export class BoProductFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogService = inject(BackofficeCatalogService);

  protected readonly isEdit = signal(false);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly serverFieldErrors = signal<Record<string, string>>({});
  protected submitted = false;
  protected readonly product = signal<AdminProductDetail | null>(null);
  protected readonly categories = signal<AdminCategory[]>([]);
  protected readonly brands = signal<AdminBrand[]>([]);

  protected readonly pendingFiles = signal<PendingFile[]>([]);
  protected readonly primaryIndex = signal(0);
  protected readonly uploadProgress = signal('');

  readonly deleteImageDialog = viewChild<ConfirmDialog>('deleteImageDialog');
  private pendingDeleteImageId: number | null = null;

  protected form = {
    name: '',
    sku: '',
    description: '',
    price: 0,
    stock: 0,
    categoryId: 0,
    brandId: 0,
    warrantyMonths: 0,
  };

  ngOnInit() {
    const productId = this.route.snapshot.paramMap.get('productId');
    if (productId) {
      this.isEdit.set(true);
      this.loadProduct(Number(productId));
    } else {
      this.loading.set(false);
    }
    this.loadDropdowns();
  }

  onPendingFilesSelected(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const files = target.files;
    if (!files || files.length === 0) return;

    const current = this.pendingFiles();
    const newEntries: PendingFile[] = [];
    for (const file of Array.from(files)) {
      newEntries.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    this.pendingFiles.set([...current, ...newEntries]);
    target.value = '';
  }

  removePendingFile(index: number) {
    const current = this.pendingFiles();
    URL.revokeObjectURL(current[index].previewUrl);
    const updated = current.filter((_, i) => i !== index);
    this.pendingFiles.set(updated);
    if (this.primaryIndex() >= updated.length) {
      this.primaryIndex.set(Math.max(0, updated.length - 1));
    } else if (this.primaryIndex() > index) {
      this.primaryIndex.set(this.primaryIndex() - 1);
    }
  }

  setPrimary(index: number) {
    this.primaryIndex.set(index);
  }

  onSave(formRef: { valid?: boolean | null }) {
    this.submitted = true;
    if (!formRef.valid) return;

    this.saving.set(true);
    this.errorMsg.set('');
    this.serverFieldErrors.set({});

    const slug = this.form.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const body: Record<string, unknown> = {
      name: this.form.name,
      slug,
      sku: this.form.sku,
      description: this.form.description,
      price: this.form.price,
      stock: this.form.stock,
      categoryId: this.form.categoryId,
      brandId: this.form.brandId,
      warrantyMonths: this.form.warrantyMonths || null,
    };

    const currentProduct = this.product();
    const request =
      this.isEdit() && currentProduct
        ? this.catalogService.updateProduct(currentProduct.id, body)
        : this.catalogService.createProduct(body);

    request.subscribe({
      next: (res) => {
        const productId = this.isEdit() && currentProduct ? currentProduct.id : res.data.id;
        const pending = this.pendingFiles();
        if (pending.length > 0) {
          this.uploadPendingImages(productId, pending);
        } else {
          this.router.navigate(['/backoffice/products']);
        }
      },
      error: (err) => {
        this.saving.set(false);
        const errBody = extractErrorBody(err.error);
        if (errBody.fieldErrors) {
          this.serverFieldErrors.set(errBody.fieldErrors);
          this.errorMsg.set('Please fix the errors below.');
        } else {
          this.errorMsg.set(errBody.message ?? 'Failed to save product');
        }
      },
    });
  }

  private uploadPendingImages(productId: number, files: PendingFile[]) {
    const primaryIdx = this.primaryIndex();
    // Reorder: primary image first (sortOrder 0)
    const ordered = [...files];
    if (primaryIdx > 0 && primaryIdx < ordered.length) {
      const [primary] = ordered.splice(primaryIdx, 1);
      ordered.unshift(primary);
    }

    let uploaded = 0;
    const uploadNext = () => {
      if (uploaded >= ordered.length) {
        this.router.navigate(['/backoffice/products']);
        return;
      }
      this.uploadProgress.set(`Uploading image ${uploaded + 1} of ${ordered.length}...`);
      this.catalogService.uploadProductImage(productId, ordered[uploaded].file).subscribe({
        next: () => {
          uploaded++;
          uploadNext();
        },
        error: () => {
          uploaded++;
          uploadNext();
        },
      });
    };
    uploadNext();
  }

  confirmDeleteImage(imageId: number) {
    this.pendingDeleteImageId = imageId;
    this.deleteImageDialog()?.show();
  }

  onDeleteImageConfirmed() {
    const currentProduct = this.product();
    const imageId = this.pendingDeleteImageId;
    if (!imageId || !currentProduct) return;
    this.catalogService.deleteProductImage(currentProduct.id, imageId).subscribe({
      next: () => {
        this.pendingDeleteImageId = null;
        this.loadProduct(currentProduct.id);
      },
    });
  }

  private loadProduct(id: number) {
    this.catalogService.getProduct(id).subscribe({
      next: (res) => {
        this.product.set(res.data);
        this.form = {
          name: res.data.name,
          sku: res.data.sku,
          description: res.data.description,
          price: res.data.price,
          stock: res.data.stock,
          categoryId: res.data.category.id,
          brandId: res.data.brand.id,
          warrantyMonths: res.data.warrantyMonths ?? 0,
        };
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadDropdowns() {
    this.catalogService.listCategories({ limit: 100 }).subscribe({
      next: (res) => this.categories.set(res.data),
    });
    this.catalogService.listBrands({ limit: 100 }).subscribe({
      next: (res) => this.brands.set(res.data),
    });
  }
}
