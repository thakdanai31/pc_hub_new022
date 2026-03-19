import { Component, inject, signal, OnInit, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BackofficeCatalogService, type AdminCategory } from '../../../core/services/backoffice-catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import type { PaginationMeta } from '../../../shared/models/pagination.model';

@Component({
  selector: 'app-bo-category-list',
  imports: [RouterLink, FormsModule, PageHeader, Pagination, ConfirmDialog, EmptyState],
  templateUrl: './category-list.html',
})
export class BoCategoryListPage implements OnInit {
  private readonly catalogService = inject(BackofficeCatalogService);
  private readonly auth = inject(AuthService);

  readonly deleteDialog = viewChild<ConfirmDialog>('deleteDialog');

  protected readonly categories = signal<AdminCategory[]>([]);
  protected readonly parentCategories = signal<AdminCategory[]>([]);
  protected readonly childrenMap = signal<Record<number, AdminCategory[]>>({});
  protected readonly expandedIds = signal<Set<number>>(new Set());
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly loading = signal(true);

  protected search = '';
  private currentPage = 1;
  private pendingDeleteCat: AdminCategory | null = null;

  ngOnInit() {
    this.loadCategories();
  }

  protected isAdmin(): boolean {
    return this.auth.user()?.role === 'ADMIN';
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadCategories();
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.loadCategories();
  }

  toggleExpand(catId: number) {
    const current = this.expandedIds();
    const next = new Set(current);
    if (next.has(catId)) {
      next.delete(catId);
    } else {
      next.add(catId);
    }
    this.expandedIds.set(next);
  }

  isExpanded(catId: number): boolean {
    return this.expandedIds().has(catId);
  }

  getChildren(parentId: number): AdminCategory[] {
    return this.childrenMap()[parentId] ?? [];
  }

  hasChildren(parentId: number): boolean {
    return (this.childrenMap()[parentId]?.length ?? 0) > 0;
  }

  onToggleActive(cat: AdminCategory) {
    this.catalogService.toggleCategoryActive(cat.id).subscribe({
      next: (res) => {
        const updated = this.categories().map((c) =>
          c.id === cat.id ? { ...c, isActive: res.data.isActive } : c,
        );
        this.categories.set(updated);
        this.buildTree(updated);
      },
    });
  }

  confirmDelete(cat: AdminCategory) {
    this.pendingDeleteCat = cat;
    this.deleteDialog()?.show();
  }

  onDeleteConfirmed() {
    if (!this.pendingDeleteCat) return;
    this.catalogService.deleteCategory(this.pendingDeleteCat.id).subscribe({
      next: () => {
        this.pendingDeleteCat = null;
        this.loadCategories();
      },
    });
  }

  private buildTree(cats: AdminCategory[]) {
    const parents: AdminCategory[] = [];
    const children: Record<number, AdminCategory[]> = {};

    for (const cat of cats) {
      if (!cat.parentId) {
        parents.push(cat);
      } else {
        if (!children[cat.parentId]) children[cat.parentId] = [];
        children[cat.parentId].push(cat);
      }
    }

    // If searching, show all as flat (search may return children without parents)
    if (this.search) {
      this.parentCategories.set(cats);
      this.childrenMap.set({});
    } else {
      this.parentCategories.set(parents);
      this.childrenMap.set(children);
    }
  }

  private loadCategories() {
    this.loading.set(true);
    this.catalogService
      .listCategories({
        page: this.currentPage,
        limit: 100,
        search: this.search || undefined,
      })
      .subscribe({
        next: (res) => {
          this.categories.set(res.data);
          this.buildTree(res.data);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
